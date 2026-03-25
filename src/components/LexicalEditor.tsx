import { useCallback, useEffect, useState, useRef } from "react";
import {
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";

import {
  $getSelection as $getSelectionLexical,
  $isRangeSelection,
  $createParagraphNode,
  $getRoot,
  $insertNodes,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  TextFormatType,
  COMMAND_PRIORITY_CRITICAL,
} from "lexical";
import {
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from "@lexical/selection";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
  ListItemNode,
} from "@lexical/list";
import { $isLinkNode, TOGGLE_LINK_COMMAND, LinkNode, AutoLinkNode } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import {
  $generateHtmlFromNodes,
  $generateNodesFromDOM,
} from "@lexical/html";
import {
  HeadingNode,
  $createHeadingNode,
  $isHeadingNode,
  QuoteNode,
  $createQuoteNode,
} from "@lexical/rich-text";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { $createHorizontalRuleNode, HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";

import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, CheckSquare,
  Quote, Minus, Palette, Link as LinkIcon,
  Undo2, Redo2, Type, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from "lucide-react";

// ── Theme for Premium Light Look ────────────────────────────────────────────────
const EDITOR_THEME = {
  paragraph: "editor-paragraph",
  quote: "editor-quote",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
  },
  list: {
    ul: "editor-list-ul",
    ol: "editor-list-ol",
    listitem: "editor-list-item",
    listitemChecked: "editor-list-item-checked",
    listitemUnchecked: "editor-list-item-unchecked",
  },
  code: "editor-code",
  link: "editor-link",
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    code: "editor-text-code",
  },
  hr: "editor-hr",
};

// ── Font Options ───────────────────────────────────────────────────────────────
const FONTS = [
  { value: "", label: "Implicit" },
  { value: "'Palatino Linotype', Palatino, serif", label: "Palatino" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, sans-serif", label: "Helvetica" },
  { value: "'Courier New', monospace", label: "Courier New" },
];

const TEXT_COLORS = [
  { value: "#ffffff", label: "Alb" },
  { value: "#f3f4f6", label: "Gri foarte deschis" },
  { value: "#d1d5db", label: "Gri deschis" },
  { value: "#9ca3af", label: "Gri" },
  { value: "#ef4444", label: "Roșu" },
  { value: "#3b82f6", label: "Albastru" },
  { value: "#22c55e", label: "Verde" },
  { value: "#eab308", label: "Galben" },
  { value: "#a855f7", label: "Violet" },
  { value: "#f97316", label: "Portocaliu" },
];

// ── Toolbar Component ───────────────────────────────────────────────────────────
function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [headingType, setHeadingType] = useState<string>("paragraph");
  const [isBulletList, setIsBulletList] = useState(false);
  const [isNumberedList, setIsNumberedList] = useState(false);
  const [isCheckList, setIsCheckList] = useState(false);
  const [isQuote, setIsQuote] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [alignment, setAlignment] = useState<string>("left");
  const [fontFamily, setFontFamily] = useState<string>("");
  const [color, setColor] = useState<string>("#000000");

  const colorPickerRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelectionLexical();
    if (!$isRangeSelection(selection)) return;

    // Text formats
    setIsBold(selection.hasFormat("bold"));
    setIsItalic(selection.hasFormat("italic"));
    setIsUnderline(selection.hasFormat("underline"));
    setIsStrikethrough(selection.hasFormat("strikethrough"));

    // Check for link
    const nodes = selection.getNodes();
    const hasLink = nodes.some(node => {
      let n: typeof node | null = node;
      while (n) {
        if ($isLinkNode(n)) return true;
        n = n.getParent() as typeof n;
      }
      return false;
    });
    setIsLink(hasLink);

    // Alignment detection
    const selAnchorNode = selection.anchor.getNode();
    const selParent = selAnchorNode.getParent();
    if (selParent) {
      const format = selParent.getFormatType ? selParent.getFormatType() : "";
      setAlignment(format || "left");
    }

    // Font family and color
    setFontFamily($getSelectionStyleValueForProperty(selection, "font-family", ""));
    setColor($getSelectionStyleValueForProperty(selection, "color", "#000000"));

    // Reset states
    setIsBulletList(false);
    setIsNumberedList(false);
    setIsCheckList(false);
    setIsQuote(false);
    setHeadingType("paragraph");

    // Check block type
    const anchor = selection.anchor;
    const nodes2 = selection.getNodes();

    for (const node of nodes2) {
      const nodeParent = node.getParent();

      if ($isListNode(nodeParent)) {
        const listType = nodeParent.getListType();
        setIsBulletList(listType === "bullet");
        setIsNumberedList(listType === "number");
        setIsCheckList(listType === "check");
        break;
      }

      if ($isHeadingNode(node)) {
        setHeadingType(node.getTag());
      }
    }

    // Check anchor node for block type
    const blockAnchorNode = anchor.getNode();
    const topLevel = blockAnchorNode.getTopLevelElementOrThrow();
    const key = topLevel.getKey();
    const element = editor.getElementByKey(key);

    if (element) {
      const tag = element.tagName.toLowerCase();
      if (tag === "h1") setHeadingType("h1");
      else if (tag === "h2") setHeadingType("h2");
      else if (tag === "h3") setHeadingType("h3");
      else if (tag === "blockquote") setIsQuote(true);
      else if (tag === "pre") setIsQuote(true);
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        FORMAT_TEXT_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }, [editor, updateToolbar]);

  // Close color picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatHeading = (type: "h1" | "h2" | "h3" | "paragraph") => {
    editor.update(() => {
      const selection = $getSelectionLexical();
      if ($isRangeSelection(selection)) {
        if (type === "paragraph") {
          const paragraph = $createParagraphNode();
          selection.insertNodes([paragraph]);
        } else {
          const heading = $createHeadingNode(type);
          selection.insertNodes([heading]);
        }
      }
    });
  };

  const formatList = (type: "bullet" | "number" | "check") => {
    if (type === "bullet") {
      if (isBulletList) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      } else {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      }
    } else if (type === "number") {
      if (isNumberedList) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      } else {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      }
    } else {
      if (isCheckList) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      } else {
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      }
    }
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelectionLexical();
      if ($isRangeSelection(selection)) {
        const quote = $createQuoteNode();
        selection.insertNodes([quote]);
      }
    });
  };

  const insertHorizontalRule = () => {
    editor.update(() => {
      const selection = $getSelectionLexical();
      if ($isRangeSelection(selection)) {
        const hr = $createHorizontalRuleNode();
        $insertNodes([hr]);
      }
    });
  };

  const applyFont = (fontFamilyValue: string) => {
    editor.update(() => {
      const selection = $getSelectionLexical();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          "font-family": fontFamilyValue,
        });
      }
    });
    editor.focus();
  };

  const applyColor = (colorValue: string) => {
    editor.update(() => {
      const selection = $getSelectionLexical();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          color: colorValue,
        });
      }
    });
    editor.focus();
    setShowColorPicker(false);
  };

  const formatAlignment = (align: "left" | "center" | "right" | "justify") => {
    editor.update(() => {
      const selection = $getSelectionLexical();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        element.setFormat(align);
      }
    });
  };

  const insertLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      const url = prompt("Introduceți URL-ul:", "https://");
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, target: "_blank" });
      }
    }
  };

  const btn = (active: boolean, onClick: () => void, label: React.ReactNode, title?: string) => (
    <button
      type="button"
      className={`toolbar-btn ${active ? "is-active" : ""}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="lexical-toolbar">
      {/* Undo/Redo */}
      {btn(false, () => editor.dispatchCommand(UNDO_COMMAND, undefined), <Undo2 size={14} />, "Anulare (Ctrl+Z)")}
      {btn(false, () => editor.dispatchCommand(REDO_COMMAND, undefined), <Redo2 size={14} />, "Refacere (Ctrl+Y)")}
      <div className="toolbar-sep" />

      {/* Font family */}
      <select
        className="toolbar-font-select"
        onChange={(e) => applyFont(e.target.value)}
        value={fontFamily}
      >
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="toolbar-sep" />

      {/* Text formatting */}
      {btn(isBold, () => formatText("bold"), <Bold size={14} />, "Bold (Ctrl+B)")}
      {btn(isItalic, () => formatText("italic"), <Italic size={14} />, "Italic (Ctrl+I)")}
      {btn(isUnderline, () => formatText("underline"), <Underline size={14} />, "Underline (Ctrl+U)")}
      {btn(isStrikethrough, () => formatText("strikethrough"), <Strikethrough size={14} />, "Tăiat")}
      <div className="toolbar-sep" />

      {/* Headings */}
      {btn(headingType === "h1", () => formatHeading("h1"), <Heading1 size={14} />, "Titlu 1")}
      {btn(headingType === "h2", () => formatHeading("h2"), <Heading2 size={14} />, "Titlu 2")}
      {btn(headingType === "h3", () => formatHeading("h3"), <Heading3 size={14} />, "Titlu 3")}
      {btn(headingType === "paragraph", () => formatHeading("paragraph"), <Type size={14} />, "Paragraf")}
      <div className="toolbar-sep" />

      {/* Alignment */}
      {btn(alignment === "left", () => formatAlignment("left"), <AlignLeft size={14} />, "Aliniere stânga")}
      {btn(alignment === "center", () => formatAlignment("center"), <AlignCenter size={14} />, "Centrat")}
      {btn(alignment === "right", () => formatAlignment("right"), <AlignRight size={14} />, "Aliniere dreapta")}
      {btn(alignment === "justify", () => formatAlignment("justify"), <AlignJustify size={14} />, "Justificat")}
      <div className="toolbar-sep" />

      {/* Lists */}
      {btn(isBulletList, () => formatList("bullet"), <List size={14} />, "Listă puncte")}
      {btn(isNumberedList, () => formatList("number"), <ListOrdered size={14} />, "Listă numerotată")}
      {btn(isCheckList, () => formatList("check"), <CheckSquare size={14} />, "Listă de verificare")}
      <div className="toolbar-sep" />

      {/* Block types */}
      {btn(isQuote, formatQuote, <Quote size={14} />, "Citat")}
      {btn(false, insertHorizontalRule, <Minus size={14} />, "Separator orizontal")}
      {btn(isLink, insertLink, <LinkIcon size={14} />, "Inserare link")}
      <div className="toolbar-sep" />

      {/* Color picker */}
      <div style={{ position: "relative" }} ref={colorPickerRef}>
        <button
          type="button"
          className={`toolbar-btn ${showColorPicker ? "is-active" : ""}`}
          onClick={() => setShowColorPicker((v) => !v)}
          title="Culoare text"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <Palette size={14} style={{ color: color }} />
        </button>
        {showColorPicker && (
          <div className="color-picker-dropdown">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => applyColor(c.value)}
                className="color-swatch"
                style={{ background: c.value }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Editor Inner Component ──────────────────────────────────────────────────────
interface LexicalEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function LexicalEditorInner({ value, onChange, placeholder = "Scrieți aici...", className }: LexicalEditorProps) {
  const [editor] = useLexicalComposerContext();
  const isExternalUpdate = useRef(false);
  const lastEmittedHtml = useRef(value);

  // Sync external value changes to editor (only if different from what we last sent)
  useEffect(() => {
    if (value === lastEmittedHtml.current) return;

    isExternalUpdate.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      // Parse HTML and convert to Lexical nodes
      const parser = new DOMParser();
      const dom = parser.parseFromString(value || "", "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      $insertNodes(nodes);
    });
    isExternalUpdate.current = false;
    lastEmittedHtml.current = value;
  }, [value, editor]);

  // Listen for editor changes and emit HTML
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (isExternalUpdate.current) return;

      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor, null);
        if (html !== lastEmittedHtml.current) {
          lastEmittedHtml.current = html;
          onChange(html);
        }
      });
    });
  }, [editor, onChange]);

  return (
    <div className={`lexical-editor-container ${className || ""}`}>
      <Toolbar />
      <div className="lexical-content">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="lexical-input"
              aria-placeholder={placeholder}
              placeholder={<div className="lexical-placeholder">{placeholder}</div>}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <AutoFocusPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <HorizontalRulePlugin />
      </div>
    </div>
  );
}

// ── Wrapper with Composer ───────────────────────────────────────────────────────
export default function LexicalEditor(props: LexicalEditorProps) {
  const initialConfig = {
    namespace: "ContractEditor",
    theme: EDITOR_THEME,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
      HorizontalRuleNode,
    ],
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <LexicalEditorInner {...props} />
    </LexicalComposer>
  );
}
