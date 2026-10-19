import { generarEnlaceWhatsAppDirecto } from "../utils/whatsapp";

export default function WhatsappFab() {
  return (
    // <aside> sin estilos (el botón es fixed): que el botón no quede fuera de todo landmark.
    <aside aria-label="Contacto rápido">
      <a
        href={generarEnlaceWhatsAppDirecto()}
        target="_blank"
        rel="noreferrer"
        className="whatsapp-fab"
        aria-label="WhatsApp"
      >
        <svg><use href="#i-whatsapp" /></svg>
      </a>
    </aside>
  );
}
