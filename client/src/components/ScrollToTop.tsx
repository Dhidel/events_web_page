import { useEffect, useLayoutEffect, useRef } from "react";
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

  // useLayoutEffect: reposiciona antes del primer pintado, para que no se vea
  // un parpadeo de la página nueva en la posición de scroll de la anterior.
  useLayoutEffect(() => {
    // "instant" para saltar sin animación aunque el <html> tenga scroll-behavior:smooth.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  // Accesibilidad: en una SPA el foco se queda en el enlace que se pulsó y el lector de
  // pantalla no se entera del cambio de página. Se le pasa el foco al h1 de la página nueva
  // (no en la primera carga). Se compara con la ruta anterior y no con un "es la primera vez"
  // porque StrictMode corre los efectos dos veces al montar. El panel admin no tiene <main>.
  const rutaAnterior = useRef(pathname);
  useEffect(() => {
    if (rutaAnterior.current === pathname) return;
    rutaAnterior.current = pathname;
    const titulo = document.querySelector<HTMLElement>("main h1");
    if (!titulo) return;
    titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
