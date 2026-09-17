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
  origen: SolicitudOrigen;
  // Objeto libre con lo seleccionado en el cotizador (personajes, cantidades, estimado)
  // cuando origen = "cotizador". Sin forma fija porque el catálogo de actos cambia.
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
    origen: { type: String, required: true, enum: SOLICITUD_ORIGENES },
    detalleCotizador: { type: Schema.Types.Mixed },
    estado: { type: String, required: true, enum: SOLICITUD_ESTADOS, default: "nuevo" },
  },
  { timestamps: true }
);

// `virtuals: true` incluye el getter `id` (string de _id) que espera el frontend.
solicitudSchema.set("toJSON", { virtuals: true, versionKey: false });

export const Solicitud = model<SolicitudAttrs, SolicitudModel>("Solicitud", solicitudSchema);
