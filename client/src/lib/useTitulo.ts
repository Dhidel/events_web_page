import { useEffect } from "react";

// Título de la pestaña por página (WCAG 2.4.2). En una SPA el <title> de index.html no cambia
// solo al navegar: sin esto todas las rutas se llaman igual en pestañas, historial y lector de pantalla.
export const TITULO_SITIO = "Show Company";

export function useTitulo(pagina: string) {
  useEffect(() => {
    document.title = `${pagina} | ${TITULO_SITIO}`;
  }, [pagina]);
}
