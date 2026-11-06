import { useEffect } from "react";

// Título de la pestaña del panel admin (WCAG 2.4.2). Las páginas públicas no lo usan: su título
// sale de data/paginas.ts y lo pone Layout.tsx (misma tabla que usa el servidor para el SEO).
export const TITULO_SITIO = "Show Company";

export function useTitulo(pagina: string) {
  useEffect(() => {
    document.title = `${pagina} | ${TITULO_SITIO}`;
  }, [pagina]);
}
