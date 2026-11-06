export interface ItemWhatsApp {
  nombre: string;
  cantidad?: number;
}

export interface DatosMensajeWhatsApp {
  nombre: string;
  tipoEvento?: string;
  fechaEvento?: string;
  mensaje?: string;
  origen: "contacto" | "cotizador";
  servicios?: ItemWhatsApp[];
  total?: number;
}

const WHATSAPP_PHONE = (import.meta.env?.VITE_WHATSAPP_PHONE as string) || "50230738716";

/**
 * Genera el enlace wa.me estructurado a partir de los datos de un formulario o cotización.
 */
export function generarEnlaceWhatsApp(datos: DatosMensajeWhatsApp): string {
  const lineas: string[] = [];

  if (datos.origen === "cotizador") {
    lineas.push("👋 ¡Hola Show Company! Acabo de armar una cotización en su sitio web:");
    lineas.push("");
    lineas.push(`👤 *Nombre:* ${datos.nombre}`);
    if (datos.tipoEvento) lineas.push(`🎉 *Evento:* ${datos.tipoEvento}`);
    if (datos.fechaEvento) lineas.push(`📅 *Fecha:* ${datos.fechaEvento}`);

    if (datos.servicios && datos.servicios.length > 0) {
      lineas.push("");
      lineas.push("📋 *Servicios solicitados:*");
      datos.servicios.forEach((s) => {
        const cant = s.cantidad && s.cantidad > 1 ? ` (x${s.cantidad})` : "";
        lineas.push(` • ${s.nombre}${cant}`);
      });
    }

    if (typeof datos.total === "number") {
      lineas.push("");
      lineas.push(`💰 *Total estimado:* Q${datos.total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`);
    }
  } else {
    lineas.push("👋 ¡Hola Show Company! Me gustaría solicitar información:");
    lineas.push("");
    lineas.push(`👤 *Nombre:* ${datos.nombre}`);
    if (datos.tipoEvento) lineas.push(`🎉 *Tipo de evento:* ${datos.tipoEvento}`);
    if (datos.fechaEvento) lineas.push(`📅 *Fecha:* ${datos.fechaEvento}`);
    if (datos.mensaje) {
      lineas.push("");
      lineas.push(`💬 *Mensaje:* ${datos.mensaje}`);
    }
  }

  lineas.push("");
  lineas.push("_Enviado desde showcompany.net_");

  const textoFinal = lineas.join("\n");
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(textoFinal)}`;
}

/**
 * Enlace para botones estáticos (botón flotante, header, redes sociales).
 */
export function generarEnlaceWhatsAppDirecto(
  mensaje = "¡Hola Show Company! Quisiera solicitar información sobre sus servicios."
): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(mensaje)}`;
}