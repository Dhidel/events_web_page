import { Solicitud, type SolicitudAttrs, type SolicitudEstado } from "../models/Solicitud";

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
  return await Solicitud.create({ ...data, estado: "nuevo" });
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