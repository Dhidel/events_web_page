import { Outlet } from "react-router-dom";
import IconSprite from "./IconSprite";
import TopStrip from "./TopStrip";
import Header from "./Header";
import Footer from "./Footer";
import WhatsappFab from "./WhatsappFab";

export default function Layout() {
  return (
    <>
      <IconSprite />
      <TopStrip />
      <Header />
      <Outlet />
      <Footer />
      <WhatsappFab />
    </>
  );
}
