import { Solicitud, type SolicitudAttrs, type SolicitudDocument, type SolicitudEstado } from "../models/Solicitud";
import { sanitizeText, sanitizeInput } from "../lib/sanitize";
import { safeErrorLog } from "../lib/privacy";
import { enviarCorreoNotificacion } from "./email.service";

export interface CrearSolicitudInput {
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  mensaje?: string;
  fechaEvento?: string;
  origen: SolicitudAttrs["origen"];
  detalleCotizador?: Record<string, unknown>;
}

// Una solicitud idéntica a otra dentro de esta ventana se trata como reenvío (doble clic,
// "Reintentar" después de un timeout que sí había guardado, recarga del formulario).
export const VENTANA_DUPLICADOS_MS = 10 * 60 * 1000;

export async function crearSolicitud(data: CrearSolicitudInput) {
  const sanitizedData: CrearSolicitudInput = {
    nombre: sanitizeText(data.nombre),
    telefono: sanitizeText(data.telefono),
    correo: sanitizeText(data.correo).toLowerCase(),
    tipoEvento: data.tipoEvento ? sanitizeText(data.tipoEvento) : undefined,
    mensaje: data.mensaje ? sanitizeText(data.mensaje) : undefined,
    fechaEvento: data.fechaEvento || undefined,
    origen: data.origen,
    detalleCotizador: data.detalleCotizador ? sanitizeInput(data.detalleCotizador) : undefined,
  };

  // Reenvío de la misma solicitud: se devuelve la ya guardada, sin crear otra ni mandar otro
  // correo. Los campos opcionales ausentes se comparan con null (que también cubre "no existe").
  // El detalle lo arma el servidor siempre en el mismo orden, así que la igualdad exacta sirve.
  const duplicada = await Solicitud.findOne({
    nombre: sanitizedData.nombre,
    telefono: sanitizedData.telefono,
    correo: sanitizedData.correo,
    tipoEvento: sanitizedData.tipoEvento ?? null,
    mensaje: sanitizedData.mensaje ?? null,
    fechaEvento: sanitizedData.fechaEvento ?? null,
    origen: sanitizedData.origen,
    detalleCotizador: sanitizedData.detalleCotizador ?? null,
    createdAt: { $gte: new Date(Date.now() - VENTANA_DUPLICADOS_MS) },
  }).sort({ createdAt: -1 });
  if (duplicada) return duplicada;

  const nuevaSolicitud = await Solicitud.create({ ...sanitizedData, estado: "nuevo" });

  // El correo es una notificación secundaria: no se espera (si Resend tarda o se cuelga, la
  // respuesta no se demora) y si falla solo queda en el log. La solicitud ya está guardada.
  void notificarPorCorreo(nuevaSolicitud);

  return nuevaSolicitud;
}

async function notificarPorCorreo(solicitud: SolicitudDocument) {
  try {
    await enviarCorreoNotificacion(solicitud);
  } catch (error) {
    // safeErrorLog enmascara correos, teléfonos y API keys; se identifica la solicitud por id.
    console.error(`[Correo] No se pudo enviar la notificación de la solicitud ${solicitud.id}: ${safeErrorLog(error)}`);
  }
}

export async function listarSolicitudes(filtro?: { estado?: SolicitudEstado; origen?: SolicitudAttrs["origen"] }) {
  const query: Record<string, unknown> = {};

  if (filtro?.estado) query.estado = filtro.estado;
  if (filtro?.origen) query.origen = filtro.origen;

  return await Solicitud.find(query).sort({ createdAt: -1 });
}

export async function actualizarEstadoSolicitud(id: string, estado: SolicitudEstado) {
  // runValidators: findByIdAndUpdate no valida contra el schema por defecto (un estado
  // inexistente se guardaría tal cual).
  return await Solicitud.findByIdAndUpdate(id, { estado }, { returnDocument: "after", runValidators: true });
}