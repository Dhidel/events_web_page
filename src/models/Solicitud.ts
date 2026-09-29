import { Schema, model, type HydratedDocument, type Model } from "mongoose";

export const SOLICITUD_ORIGENES = ["cotizador", "contacto"] as const;
export type SolicitudOrigen = (typeof SOLICITUD_ORIGENES)[number];

export const SOLICITUD_ESTADOS = ["nuevo", "contactado", "propuesta_enviada", "confirmado"] as const;
export type SolicitudEstado = (typeof SOLICITUD_ESTADOS)[number];

export interface SolicitudAttrs {
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  mensaje?: string;
  // Fecha estimada del evento (formulario de Contacto), "YYYY-MM-DD". Se guarda como texto
  // y no como Date: es un día del calendario, no un instante, y así no cambia con la zona horaria.
  fechaEvento?: string;
  origen: SolicitudOrigen;
  // Lo seleccionado en el cotizador cuando origen = "cotizador". Lo arma el servidor con
  // los precios de MongoDB (ver services/cotizador.service.ts); nunca se guarda tal cual
  // lo manda el cliente.
  detalleCotizador?: Record<string, unknown>;
  estado: SolicitudEstado;
}

export type SolicitudDocument = HydratedDocument<SolicitudAttrs>;
type SolicitudModel = Model<SolicitudAttrs>;

const solicitudSchema = new Schema<SolicitudAttrs, SolicitudModel>(
  {
    nombre: { type: String, required: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    correo: { type: String, required: true, trim: true, lowercase: true },
    tipoEvento: { type: String, trim: true },
    mensaje: { type: String, trim: true },
    fechaEvento: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    origen: { type: String, required: true, enum: SOLICITUD_ORIGENES },
    detalleCotizador: { type: Schema.Types.Mixed },
    estado: { type: String, required: true, enum: SOLICITUD_ESTADOS, default: "nuevo" },
  },
  { timestamps: true }
);

// `virtuals: true` incluye el getter `id` (string de _id) que espera el frontend;
// `flattenObjectIds` deja `_id` como string (así coincide con los esquemas de /swagger).
solicitudSchema.set("toJSON", { virtuals: true, versionKey: false, flattenObjectIds: true });

// listarSolicitudes() sin filtro: más recientes primero.
solicitudSchema.index({ createdAt: -1 });
// listarSolicitudes(estado): filtra por estado y ordena por fecha. También cubre filtros
// solo por estado (es el prefijo del índice), así que no hace falta un índice aparte en estado.
solicitudSchema.index({ estado: 1, createdAt: -1 });

export const Solicitud = model<SolicitudAttrs, SolicitudModel>("Solicitud", solicitudSchema);
