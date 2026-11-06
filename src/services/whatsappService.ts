export interface DetalleCotizadorWA {
  personajes?: Array<{
    nombre: string;
    cantidad: number;
    subtotal: number;
  }>;
  total?: number;
}

export interface SolicitudWhatsApp {
  nombre: string;
  telefono?: string;
  correo?: string;
  tipoEvento?: string;
  fechaEvento?: string;
  mensaje?: string;
  origen?: "contacto" | "cotizador";
  detalleCotizador?: DetalleCotizadorWA;
}

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || "50230738716";

/**
 * Requisito técnico: Función reutilizable que construye el mensaje de WhatsApp
 * formateado y legible con todos los datos relevantes de la solicitud.
 */
export function construirMensajeWhatsApp(solicitud: SolicitudWhatsApp): string {
  const lineas: string[] = [];

  if (solicitud.origen === "cotizador" && solicitud.detalleCotizador) {
    lineas.push("👋 ¡Hola Show Company! Acabo de armar una cotización en su sitio web:");
    lineas.push("");
    lineas.push(`👤 *Nombre:* ${solicitud.nombre}`);
    if (solicitud.telefono) lineas.push(`📞 *Teléfono:* ${solicitud.telefono}`);
    if (solicitud.correo) lineas.push(`✉️ *Correo:* ${solicitud.correo}`);
    if (solicitud.tipoEvento) lineas.push(`🎉 *Tipo de evento:* ${solicitud.tipoEvento}`);
    if (solicitud.fechaEvento) lineas.push(`📅 *Fecha estimada:* ${solicitud.fechaEvento}`);

    const personajes = solicitud.detalleCotizador.personajes;
    if (personajes && personajes.length > 0) {
      lineas.push("");
      lineas.push("📋 *Detalle del estimado:*");
      personajes.forEach((p) => {
        lineas.push(` • ${p.cantidad}x ${p.nombre} (Q${p.subtotal.toLocaleString("es-GT")})`);
      });
    }

    if (typeof solicitud.detalleCotizador.total === "number") {
      lineas.push("");
      lineas.push(`💰 *Total estimado:* Q${solicitud.detalleCotizador.total.toLocaleString("es-GT")}`);
    }
  } else {
    lineas.push("👋 ¡Hola Show Company! Me gustaría solicitar información:");
    lineas.push("");
    lineas.push(`👤 *Nombre:* ${solicitud.nombre}`);
    if (solicitud.telefono) lineas.push(`📞 *Teléfono:* ${solicitud.telefono}`);
    if (solicitud.correo) lineas.push(`✉️ *Correo:* ${solicitud.correo}`);
    if (solicitud.tipoEvento) lineas.push(`🎉 *Tipo de evento:* ${solicitud.tipoEvento}`);
    if (solicitud.fechaEvento) lineas.push(`📅 *Fecha estimada:* ${solicitud.fechaEvento}`);
    if (solicitud.mensaje) {
      lineas.push("");
      lineas.push(`💬 *Mensaje:* ${solicitud.mensaje}`);
    }
  }

  lineas.push("");
  lineas.push("_Enviado desde showcompany.net_");

  return lineas.join("\n");
}

/**
 * Genera el enlace wa.me asegurando la codificación correcta de caracteres
 * especiales, saltos de línea y acentos.
 */
export function generarEnlaceWhatsAppBackend(
  solicitud: SolicitudWhatsApp,
  telefonoDestino: string = WHATSAPP_PHONE
): string {
  const mensaje = construirMensajeWhatsApp(solicitud);
  const numeroLimpio = telefonoDestino.replace(/\D/g, "");
  return `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Genera un enlace para que el administrador le responda directamente al cliente
 * por WhatsApp con un solo clic.
 */
export function generarEnlaceRespuestaCliente(solicitud: SolicitudWhatsApp): string | null {
  if (!solicitud.telefono) return null;

  let numeroCliente = solicitud.telefono.replace(/\D/g, "");
  // Si son 8 dígitos (Guatemala), se agrega el prefijo 502
  if (numeroCliente.length === 8) {
    numeroCliente = `502${numeroCliente}`;
  }

  const mensajeRespuesta = `¡Hola ${solicitud.nombre}! Te saludamos de Show Company. Recibimos tu solicitud para tu evento${
    solicitud.tipoEvento ? ` (${solicitud.tipoEvento})` : ""
  }. ¿Cómo estás?`;

  return `https://wa.me/${numeroCliente}?text=${encodeURIComponent(mensajeRespuesta)}`;
}