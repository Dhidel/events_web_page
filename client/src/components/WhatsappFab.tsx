import { generarEnlaceWhatsAppDirecto } from "../utils/whatsapp";

export default function WhatsappFab() {
  return (
    <a
      href={generarEnlaceWhatsAppDirecto()}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-fab"
      aria-label="WhatsApp"
    >
      <svg><use href="#i-whatsapp" /></svg>
    </a>
  );
}