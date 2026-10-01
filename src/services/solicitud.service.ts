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
  return await Solicitud.findByIdAndUpdate(id, { estado }, { new: true, runValidators: true });
}