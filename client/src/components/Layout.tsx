import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PAGINAS_PUBLICAS, TITULO_POR_DEFECTO } from "../data/paginas";
import IconSprite from "./IconSprite";
import TopStrip from "./TopStrip";
import Header from "./Header";
import Footer from "./Footer";
import WhatsappFab from "./WhatsappFab";

export default function Layout() {
  // El servidor ya manda el título correcto al cargar; esto lo actualiza al navegar sin
  // recargar (los enlaces del menú no piden otra vez el HTML).
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = PAGINAS_PUBLICAS[pathname.replace(/(.)\/+$/, "$1")]?.title ?? TITULO_POR_DEFECTO;
  }, [pathname]);

  return (
    <>
      {/* Primer elemento con Tab: salta las redes y el menú. Oculto hasta que recibe foco (.skip-link). */}
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <IconSprite />
      <TopStrip />
      <Header />
      {/* tabIndex -1: el enlace "Saltar al contenido" le puede pasar el foco. */}
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <WhatsappFab />
    </>
  );
}
