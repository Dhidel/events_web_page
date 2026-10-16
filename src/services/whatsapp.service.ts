import { safeErrorLog } from "../lib/privacy";

export interface ItemWhatsAppBackend {
  nombre?: string;
  cantidad?: number;
  subtotal?: number;
}

export interface SolicitudWhatsAppBackend {
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  fechaEvento?: string;
  mensaje?: string;
  origen: "contacto" | "cotizador";
  detalleCotizador?: {
    personajes?: ItemWhatsAppBackend[];
    servicios?: ItemWhatsAppBackend[];
    items?: ItemWhatsAppBackend[];
    total?: number;
    fueraDeCapital?: boolean;
  };
}

const WHATSAPP_NUMERO_OFICIAL = process.env.WHATSAPP_PHONE || "50230738716";

/**
 * Requisito técnico [11.2]: Construcción formateada y legible del mensaje.
 */
export function construirMensajeWhatsApp(solicitud: SolicitudWhatsAppBackend): string {
  try {
    const lineas: string[] = [];

    if (solicitud.origen === "cotizador" && solicitud.detalleCotizador) {
      lineas.push("👋 ¡Hola Show Company! Acabo de armar una cotización en su sitio web:");
      lineas.push("");
      lineas.push(`👤 *Nombre:* ${solicitud.nombre}`);
      if (solicitud.telefono) lineas.push(`📞 *Teléfono:* ${solicitud.telefono}`);
      if (solicitud.correo) lineas.push(`✉️ *Correo:* ${solicitud.correo}`);
      if (solicitud.tipoEvento) lineas.push(`🎉 *Tipo de evento:* ${solicitud.tipoEvento}`);
      if (solicitud.fechaEvento) lineas.push(`📅 *Fecha estimada:* ${solicitud.fechaEvento}`);

      const detalle = solicitud.detalleCotizador;
      const items = detalle.personajes || detalle.servicios || detalle.items || [];

      if (items.length > 0) {
        lineas.push("");
        lineas.push("📋 *Detalle del estimado:*");
        items.forEach((p) => {
          const cant = p.cantidad ?? 1;
          const nombre = p.nombre || "Servicio";
          const sub = typeof p.subtotal === "number" ? ` (Q${p.subtotal.toLocaleString("es-GT")})` : "";
          lineas.push(` • ${cant}x ${nombre}${sub}`);
        });
      }

      if (typeof detalle.total === "number") {
        lineas.push("");
        lineas.push(`💰 *Total estimado:* Q${detalle.total.toLocaleString("es-GT")}`);
      }

      if (detalle.fueraDeCapital) {
        lineas.push("");
        lineas.push("📍 _Nota: Evento fuera de la Ciudad Capital (traslado a cotizar aparte)_");
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
  } catch (error) {
    console.error(`[WhatsApp] Error construyendo mensaje: ${safeErrorLog(error)}`);
    return `Hola Show Company, me gustaría cotizar un evento. Mi nombre es ${solicitud.nombre}.`;
  }
}

/**
 * Genera el enlace wa.me para la solicitud con codificación segura.
 */
export function generarEnlaceWhatsAppBackend(
  solicitud: SolicitudWhatsAppBackend,
  numeroDestino: string = WHATSAPP_NUMERO_OFICIAL
): string {
  try {
    const mensaje = construirMensajeWhatsApp(solicitud);
    const numeroLimpio = numeroDestino.replace(/\D/g, "");
    return `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
  } catch (error) {
    console.error(`[WhatsApp] Error generando enlace wa.me: ${safeErrorLog(error)}`);
    const numeroLimpio = numeroDestino.replace(/\D/g, "");
    return `https://wa.me/${numeroLimpio}`;
  }
}

/**
 * Genera el enlace de respuesta para el administrador.
 */
export function generarEnlaceRespuestaCliente(solicitud: SolicitudWhatsAppBackend): string {
  try {
    let numeroCliente = solicitud.telefono.replace(/\D/g, "");
    if (numeroCliente.length === 8) {
      numeroCliente = `502${numeroCliente}`;
    }

    const textoRespuesta = `¡Hola ${solicitud.nombre}! Te saludamos de Show Company. Recibimos tu ${
      solicitud.origen === "cotizador" ? "cotización" : "mensaje"
    } para tu evento${solicitud.tipoEvento ? ` (${solicitud.tipoEvento})` : ""}. ¿En qué podemos asesorarte?`;

    return `https://wa.me/${numeroCliente}?text=${encodeURIComponent(textoRespuesta)}`;
  } catch (error) {
    console.error(`[WhatsApp] Error generando enlace respuesta: ${safeErrorLog(error)}`);
    const numeroCliente = solicitud.telefono.replace(/\D/g, "");
    return `https://wa.me/${numeroCliente}`;
  }
}

/**
 * Requisito [11.3]: Función de envío aislada para cuando se integre la API oficial.
 * Garantiza que un error de red o de autenticación de Meta no interrumpa el guardado.
 */
export async function enviarNotificacionWhatsAppOficial(solicitud: SolicitudWhatsAppBackend): Promise<boolean> {
  try {
    // Si no está configurado el token de Meta Cloud API, no hace nada
    if (!process.env.WHATSAPP_API_TOKEN) {
      return false;
    }

    // Aquí iría la llamada fetch a graph.facebook.com
    // const res = await fetch("https://graph.facebook.com/v18.0/...", { ... });
    return true;
  } catch (error) {
    // Log sin exponer credenciales ni tokens gracias a safeErrorLog
    console.error(`[WhatsApp API] Error al enviar notificación: ${safeErrorLog(error)}`);
    return false;
  }
}