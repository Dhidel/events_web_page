import { Outlet } from "react-router-dom";
import IconSprite from "./IconSprite";
import TopStrip from "./TopStrip";
import Header from "./Header";
import Footer from "./Footer";
import WhatsappFab from "./WhatsappFab";

export default function Layout() {
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
