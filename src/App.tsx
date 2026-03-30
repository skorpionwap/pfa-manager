import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import GlobalSearch from "@/components/GlobalSearch";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Clienti from "@/pages/Clienti";
import Oferte from "@/pages/Oferte";
import Facturi from "@/pages/Facturi";
import Contracte from "@/pages/Contracte";
import Cheltuieli from "@/pages/Cheltuieli";
import Fiscal from "@/pages/Fiscal";
import Raport from "@/pages/Raport";
import Declaratie from "@/pages/Declaratie";
import Setari from "@/pages/Setari";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <GlobalSearch />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="clienti" element={<Clienti />} />
              <Route path="oferte" element={<Oferte />} />
              <Route path="facturi" element={<Facturi />} />
              <Route path="contracte" element={<Contracte />} />
              <Route path="cheltuieli" element={<Cheltuieli />} />
              <Route path="fiscal" element={<Fiscal />} />
              <Route path="raport" element={<Raport />} />
              <Route path="declaratie" element={<Declaratie />} />
              <Route path="setari" element={<Setari />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
