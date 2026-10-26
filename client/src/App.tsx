import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import Servicios from "./pages/Servicios";
import Cotizador from "./pages/Cotizador";
import Galeria from "./pages/Galeria";
import Nosotros from "./pages/Nosotros";
import Contacto from "./pages/Contacto";

// El panel admin se descarga aparte, solo al entrar a /admin: los visitantes del sitio no
// bajan su código. Las páginas públicas siguen en el archivo principal: separarlas haría
// esperar una descarga más antes de dibujar la página (y su foto principal).
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCotizaciones = lazy(() => import("./pages/AdminCotizaciones"));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/cotizador" element={<Cotizador />} />
          <Route path="/galeria" element={<Galeria />} />
          <Route path="/nosotros" element={<Nosotros />} />
          <Route path="/contacto" element={<Contacto />} />
        </Route>
        {/* Sin Layout público: el panel administrativo no lleva header/footer del sitio ni aparece en la nav */}
        <Route path="/admin" element={<Suspense><AdminLogin /></Suspense>} />
        <Route path="/admin/dashboard" element={<Suspense><AdminDashboard /></Suspense>} />
        <Route path="/admin/cotizaciones" element={<Suspense><AdminCotizaciones /></Suspense>} />
      </Routes>
    </>
  );
}
