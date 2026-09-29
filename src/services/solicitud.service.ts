import { Solicitud, type SolicitudAttrs, type SolicitudEstado } from "../models/Solicitud";
import { sanitizeText, sanitizeInput } from "../lib/sanitize";

export interface CrearSolicitudInput {
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  mensaje?: string;
  origen: SolicitudAttrs["origen"];
  detalleCotizador?: Record<string, unknown>;
}

export async function crearSolicitud(data: CrearSolicitudInput) {
  // Sanitización de todos los campos de texto
  const sanitizedData: CrearSolicitudInput = {
    nombre: sanitizeText(data.nombre),
    telefono: sanitizeText(data.telefono),
    correo: sanitizeText(data.correo).toLowerCase(),
    tipoEvento: data.tipoEvento ? sanitizeText(data.tipoEvento) : undefined,
    mensaje: data.mensaje ? sanitizeText(data.mensaje) : undefined,
    origen: data.origen,
    detalleCotizador: data.detalleCotizador ? sanitizeInput(data.detalleCotizador) : undefined,
  };

  return await Solicitud.create({ ...sanitizedData, estado: "nuevo" });
}

export async function listarSolicitudes(estado?: SolicitudEstado) {
  const filter = estado ? { estado } : {};
  return await Solicitud.find(filter).sort({ createdAt: -1 });
}

export async function actualizarEstadoSolicitud(id: string, estado: SolicitudEstado) {
  const doc = await Solicitud.findById(id);
  if (!doc) return null;

  doc.estado = estado;
  await doc.save();
  return doc;
}