use base64::{engine::general_purpose, Engine as _};
use std::fs;

// ── Model list structs ────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
struct ChatMessage {
    role: String,
    text: String,
}

#[derive(serde::Serialize)]
struct GeminiModel {
    name: String,
    display_name: String,
}

#[derive(serde::Deserialize)]
struct ListModelsResponse {
    models: Option<Vec<ListModelItem>>,
}

#[derive(serde::Deserialize)]
struct ListModelItem {
    name: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "supportedGenerationMethods", default)]
    supported_generation_methods: Vec<String>,
}

// ── Gemini response structs ───────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(serde::Deserialize)]
struct GeminiCandidate {
    content: GeminiResponseContent,
}

#[derive(serde::Deserialize)]
struct GeminiResponseContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(serde::Deserialize)]
struct GeminiResponsePart {
    text: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn detect_mime_type(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".pdf") { "application/pdf" }
    else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") { "image/jpeg" }
    else if lower.ends_with(".png") { "image/png" }
    else if lower.ends_with(".webp") { "image/webp" }
    else { "application/octet-stream" }
}

async fn gemini_call(client: &reqwest::Client, api_key: &str, model: &str, body: serde_json::Value) -> Result<String, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );
    let response = client.post(&url).json(&body).send().await
        .map_err(|e| format!("Eroare rețea: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Eroare API Gemini ({}): {}", status, error_text));
    }

    let gemini_response: GeminiResponse = response.json().await
        .map_err(|e| format!("Eroare la parsarea răspunsului: {}", e))?;

    gemini_response.candidates.into_iter().next()
        .and_then(|c| c.content.parts.into_iter().next())
        .map(|p| p.text)
        .ok_or_else(|| "Răspuns gol de la Gemini".to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// List models that support generateContent
#[tauri::command]
async fn list_gemini_models(api_key: String) -> Result<Vec<GeminiModel>, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        api_key
    );
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await
        .map_err(|e| format!("Eroare rețea: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        return Err(format!("Cheie API invalidă sau eroare ({})", status));
    }

    let list: ListModelsResponse = response.json().await
        .map_err(|e| format!("Eroare parsare: {}", e))?;

    let models = list.models.unwrap_or_default()
        .into_iter()
        .filter(|m| m.supported_generation_methods.iter().any(|s| s == "generateContent"))
        .map(|m| GeminiModel {
            name: m.name.trim_start_matches("models/").to_string(),
            display_name: m.display_name,
        })
        .collect();

    Ok(models)
}

/// Text-only call — fiscal chat, legislation analysis, annual narrative
#[tauri::command]
async fn call_gemini(api_key: String, model: String, prompt: String) -> Result<String, String> {
    let body = serde_json::json!({
        "contents": [{"parts": [{"text": prompt}]}]
    });
    gemini_call(&reqwest::Client::new(), &api_key, &model, body).await
}

/// Chat call with full conversation history for memory
#[tauri::command]
async fn call_gemini_chat(api_key: String, model: String, messages: Vec<ChatMessage>) -> Result<String, String> {
    // Convert frontend messages to Gemini API format
    let contents: Vec<serde_json::Value> = messages.into_iter()
        .map(|m| {
            let role = if m.role == "user" { "user" } else { "model" };
            serde_json::json!({
                "role": role,
                "parts": [{"text": m.text}]
            })
        })
        .collect();

    let body = serde_json::json!({ "contents": contents });
    gemini_call(&reqwest::Client::new(), &api_key, &model, body).await
}

/// Generic file analysis — receipt scanning (PDF, JPG, PNG, WebP)
#[tauri::command]
async fn analyze_file(api_key: String, model: String, file_path: String, prompt: String) -> Result<String, String> {
    let file_bytes = fs::read(&file_path)
        .map_err(|e| format!("Nu pot citi fișierul: {}", e))?;
    let file_b64 = general_purpose::STANDARD.encode(&file_bytes);
    let mime_type = detect_mime_type(&file_path);

    let body = serde_json::json!({
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": mime_type, "data": file_b64}}
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"}
    });
    gemini_call(&reqwest::Client::new(), &api_key, &model, body).await
}

/// Contract PDF analysis with structured JSON response
#[tauri::command]
async fn analyze_contract_pdf(api_key: String, model: String, file_path: String, prompt: String) -> Result<String, String> {
    let file_bytes = fs::read(&file_path)
        .map_err(|e| format!("Nu pot citi fișierul: {}", e))?;
    let file_b64 = general_purpose::STANDARD.encode(&file_bytes);

    let body = serde_json::json!({
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": "application/pdf", "data": file_b64}}
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"}
    });
    gemini_call(&reqwest::Client::new(), &api_key, &model, body).await
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_gemini_models, analyze_contract_pdf, analyze_file, call_gemini, call_gemini_chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
