import { Solicitud, type SolicitudAttrs, type SolicitudEstado } from "../models/Solicitud";
import { sanitizeText, sanitizeInput } from "../lib/sanitize";
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

  try {
    await enviarCorreoNotificacion(nuevaSolicitud);
  } catch (error) {
    console.error("⚠ No se pudo enviar el correo de notificación:", error);
  }

  return nuevaSolicitud;
}

export async function listarSolicitudes(filtro?: { estado?: SolicitudEstado; origen?: SolicitudAttrs["origen"] }) {
  const query: Record<string, unknown> = {};

  if (filtro?.estado) query.estado = filtro.estado;
  if (filtro?.origen) query.origen = filtro.origen;

  return await Solicitud.find(query).sort({ createdAt: -1 });
}

export async function actualizarEstadoSolicitud(id: string, estado: SolicitudEstado) {
  return await Solicitud.findByIdAndUpdate(id, { estado }, { new: true });
}