import { Schema, model, type HydratedDocument, type Model } from "mongoose";

export const SERVICIO_CATEGORIAS = ["Batucadas", "Zanqueros", "Personajes"] as const;
export type ServicioCategoria = (typeof SERVICIO_CATEGORIAS)[number];

export const SERVICIO_UNIDADES = ["por hora", "por evento"] as const;
export type ServicioUnidad = (typeof SERVICIO_UNIDADES)[number];

export interface ServicioAttrs {
  nombre: string;
  descripcion: string;
  categoria: ServicioCategoria;
  // Precio en quetzales, por personaje, dentro de la Ciudad Capital.
  precio: number;
  unidad: ServicioUnidad;
  // false = oculto en el sitio sin borrarlo de la base.
  activo: boolean;
  // Posición en el catálogo (Servicios y Cotizador lo muestran en este orden).
  orden: number;
}

export type ServicioDocument = HydratedDocument<ServicioAttrs>;
type ServicioModel = Model<ServicioAttrs>;

const servicioSchema = new Schema<ServicioAttrs, ServicioModel>(
  {
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    categoria: { type: String, required: true, enum: SERVICIO_CATEGORIAS },
    precio: { type: Number, required: true, min: 0 },
    unidad: { type: String, required: true, enum: SERVICIO_UNIDADES, default: "por hora" },
    activo: { type: Boolean, default: true },
    orden: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// `virtuals: true` incluye el getter `id` (string de _id) que espera el frontend;
// `flattenObjectIds` deja `_id` como string (así coincide con los esquemas de /swagger).
servicioSchema.set("toJSON", { virtuals: true, versionKey: false, flattenObjectIds: true });

export const Servicio = model<ServicioAttrs, ServicioModel>("Servicio", servicioSchema);
