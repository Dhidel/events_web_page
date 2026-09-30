import { resend } from "../lib/resend";
import type { SolicitudAttrs } from "../models/Solicitud";

export interface SolicitudParaCorreo {
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  fechaEvento?: string;
  mensaje?: string;
  origen: SolicitudAttrs["origen"];
  detalleCotizador?: Record<string, unknown>;
}

interface ItemCotizacion {
  servicioId?: string;
  nombre?: string;
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
}

function formatearMoneda(monto: number | undefined): string {
  if (typeof monto !== "number") return "-";
  return `Q${monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generarTemplateCorreo(solicitud: SolicitudParaCorreo): string {
  const esCotizador = solicitud.origen === "cotizador";
  const titulo = esCotizador ? "Nueva Cotización Recibida" : "Nuevo Mensaje de Contacto";

  let bloqueCotizador = "";

  if (esCotizador && solicitud.detalleCotizador) {
    const detalle = solicitud.detalleCotizador;

    const items: ItemCotizacion[] = Array.isArray(detalle.personajes)
      ? (detalle.personajes as ItemCotizacion[])
      : Array.isArray(detalle.servicios)
      ? (detalle.servicios as ItemCotizacion[])
      : Array.isArray(detalle.items)
      ? (detalle.items as ItemCotizacion[])
      : [];

    const total = typeof detalle.total === "number" ? detalle.total : undefined;

    const filasTabla = items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px; color: #111827; font-size: 14px;">${item.nombre || "Servicio"}</td>
          <td style="padding: 10px 8px; text-align: center; color: #374151; font-size: 14px;">${item.cantidad ?? 1}</td>
          <td style="padding: 10px 8px; text-align: right; color: #374151; font-size: 14px;">${formatearMoneda(item.precioUnitario)}</td>
          <td style="padding: 10px 8px; text-align: right; color: #111827; font-weight: 600; font-size: 14px;">${formatearMoneda(item.subtotal)}</td>
        </tr>
      `
      )
      .join("");

    bloqueCotizador = `
      <div style="margin-top: 24px; padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h3 style="margin: 0 0 14px 0; color: #111827; font-size: 16px; font-weight: 700;">
          Desglose de Cotización
        </h3>

        ${
          items.length > 0
            ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #d1d5db; text-align: left;">
                <th style="padding: 8px; color: #4b5563; font-size: 12px; text-transform: uppercase;">Servicio / Personaje</th>
                <th style="padding: 8px; text-align: center; color: #4b5563; font-size: 12px; text-transform: uppercase;">Cant.</th>
                <th style="padding: 8px; text-align: right; color: #4b5563; font-size: 12px; text-transform: uppercase;">P. Unitario</th>
                <th style="padding: 8px; text-align: right; color: #4b5563; font-size: 12px; text-transform: uppercase;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${filasTabla}
            </tbody>
          </table>
        `
            : `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">No se especificaron items individuales.</p>`
        }

        ${
          total !== undefined
            ? `
          <div style="text-align: right; padding-top: 10px; border-top: 2px solid #e5e7eb;">
            <span style="font-size: 15px; color: #4b5563; font-weight: 600; margin-right: 12px;">Total Estimado:</span>
            <span style="font-size: 18px; color: #1e3a8a; font-weight: 800;">${formatearMoneda(total)}</span>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #111827; margin: 0 0 8px 0; padding-bottom: 12px; border-bottom: 2px solid #f3f4f6;">
        ${titulo}
      </h2>
      <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px 0;">
        Se ha recibido una nueva solicitud a través del sitio web.
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600; width: 140px;">Origen:</td>
          <td style="padding: 6px 0; color: #111827; text-transform: capitalize;">${solicitud.origen}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Nombre:</td>
          <td style="padding: 6px 0; color: #111827;">${solicitud.nombre}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Teléfono:</td>
          <td style="padding: 6px 0; color: #111827;"><a href="tel:${solicitud.telefono}" style="color: #2563eb; text-decoration: none;">${solicitud.telefono}</a></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Correo:</td>
          <td style="padding: 6px 0; color: #111827;"><a href="mailto:${solicitud.correo}" style="color: #2563eb; text-decoration: none;">${solicitud.correo}</a></td>
        </tr>
        ${
          solicitud.tipoEvento
            ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Tipo de Evento:</td>
          <td style="padding: 6px 0; color: #111827;">${solicitud.tipoEvento}</td>
        </tr>`
            : ""
        }
        ${
          solicitud.fechaEvento
            ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Fecha de Evento:</td>
          <td style="padding: 6px 0; color: #111827;">${solicitud.fechaEvento}</td>
        </tr>`
            : ""
        }
      </table>

      ${
        solicitud.mensaje
          ? `
        <div style="margin-top: 16px; padding: 14px; background-color: #f9fafb; border-left: 4px solid #2563eb; border-radius: 4px;">
          <strong style="color: #1f2937; font-size: 13px; text-transform: uppercase;">Mensaje del cliente:</strong>
          <p style="margin: 6px 0 0 0; color: #374151; font-size: 14px; white-space: pre-line;">${solicitud.mensaje}</p>
        </div>`
          : ""
      }

      ${bloqueCotizador}

      <p style="margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Notificación generada automáticamente por Show Company.
      </p>
    </div>
  `;
}

export async function enviarCorreoNotificacion(solicitud: SolicitudParaCorreo) {
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const to = process.env.EMAIL_TO_NOTIFY || "djosorio@ufm.edu";
  const subject =
    solicitud.origen === "cotizador"
      ? `Nueva Cotización: ${solicitud.nombre}`
      : `Nuevo Contacto: ${solicitud.nombre}`;

  const html = generarTemplateCorreo(solicitud);

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("❌ [EmailService] Error al enviar notificación:", error);
    throw new Error(`Error enviando correo: ${error.message}`);
  }

  console.log(" Correo enviado con éxito por Resend. ID:", data?.id);
  return data;
}