import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Al cambiar de ruta, vuelve al inicio de la página. React Router no lo hace solo:
// sin esto, al navegar se conserva el scroll de la página anterior y se "cae" a
// media altura de la nueva (por eso los botones que llevan a /contacto aterrizaban
// unos en el formulario y otros al pie de la sección, según desde dónde se pulsaran).
//
// Solo reacciona a `pathname`, no a `hash`, para no romper los enlaces internos
// de misma página (#catalogo, #redes, ...).
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // "instant" para saltar sin animación aunque el <html> tenga scroll-behavior:smooth.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
