import { t, type Static, type TSchema } from "elysia";
import { SERVICIO_CATEGORIAS, SERVICIO_UNIDADES } from "../models/Servicio";
import { GALLERY_CATEGORIES } from "../models/GalleryImage";
import { SOLICITUD_ESTADOS, SOLICITUD_ORIGENES } from "../models/Solicitud";
import { GENERIC_ERROR } from "./errors";

// Esquemas de respuesta de la API. Sirven para dos cosas: documentar en /swagger
// (con un ejemplo de respuesta cada uno) y validar en runtime que lo que devuelve
// cada endpoint coincide con lo documentado. Si se agrega un campo a un modelo,
// hay que agregarlo aquí también o Elysia lo quita de la respuesta.

const literals = <const T extends readonly [string, ...string[]]>(values: T) => t.UnionEnum(values);

// Documento de Mongoose → la forma JSON documentada. El toJSON de cada modelo ya
// deja _id como string y agrega id y timestamps, pero los tipos de Mongoose no lo
// reflejan; el esquema de `response` de cada ruta lo verifica en runtime.
export const toApi = <S extends TSchema>(_schema: S, doc: { toJSON(): unknown }) => doc.toJSON() as Static<S>;

// Formato único de error (lo genera src/lib/errors.ts). Un esquema por código solo
// para que cada uno muestre en /swagger un ejemplo realista.
const errorSchema = (description: string, example: string) =>
  t.Object({ error: t.String({ description: "Mensaje apto para mostrar al usuario." }) }, { description, examples: [{ error: example }] });

export const ErrorSchemas = {
  400: errorSchema("El cuerpo de la solicitud no es JSON/FormData válido.", "El cuerpo de la solicitud no tiene un formato válido."),
  401: errorSchema("Falta el token, es inválido o expiró.", "No autorizado."),
  404: errorSchema("El recurso con ese id no existe.", "Solicitud no encontrada."),
  422: errorSchema("Datos inválidos o faltantes (nombra los campos con problema).", "Datos inválidos o faltantes: correo."),
  500: errorSchema("Error inesperado. Nunca incluye detalles internos.", GENERIC_ERROR),
  502: errorSchema("Falló el servicio externo de imágenes (Cloudinary).", "No se pudo procesar la imagen. Intenta de nuevo."),
};

// Uso: response: { 200: X, ...errorResponses(401, 404, 500) }
export const errorResponses = <const C extends keyof typeof ErrorSchemas>(...codes: C[]) =>
  Object.fromEntries(codes.map((c) => [c, ErrorSchemas[c]])) as Pick<typeof ErrorSchemas, C>;

// Id de MongoDB en rutas /:id. Un id mal formado responde 422 en vez de llegar a Mongo.
export const IdParams = t.Object({
  id: t.String({ pattern: "^[a-fA-F0-9]{24}$", description: "Id de MongoDB (24 caracteres hex).", examples: ["6ab4600a9f8e7d6c5b4a3921"] }),
});

export const ServicioSchema = t.Object(
  {
    _id: t.String(),
    id: t.String(),
    nombre: t.String(),
    descripcion: t.String(),
    categoria: literals(SERVICIO_CATEGORIAS),
    precio: t.Number({ description: "Precio en quetzales, por personaje, dentro de la Ciudad Capital." }),
    unidad: literals(SERVICIO_UNIDADES),
    activo: t.Boolean(),
    orden: t.Number({ description: "Posición en el catálogo." }),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  },
  {
    examples: [
      {
        _id: "6ab45b6121f69b5836d36221",
        id: "6ab45b6121f69b5836d36221",
        nombre: "Batucada Hora Loca — 3 Tamboreros",
        descripcion: "Música variada, interacción con los invitados, animación",
        categoria: "Batucadas",
        precio: 3800,
        unidad: "por hora",
        activo: true,
        orden: 0,
        createdAt: "2026-09-23T23:06:09.856Z",
        updatedAt: "2026-09-23T23:06:09.856Z",
      },
    ],
  }
);

export const GalleryImageSchema = t.Object(
  {
    _id: t.String(),
    id: t.String(),
    imageUrl: t.String({ description: "URL pública de la imagen en Cloudinary." }),
    publicId: t.String({ description: "public_id de Cloudinary (para reemplazar/borrar)." }),
    alt: t.String(),
    category: literals(GALLERY_CATEGORIES),
    categoryLabel: t.String({ description: "Etiqueta legible de la categoría, derivada en el servidor." }),
    label: t.String(),
    order: t.Number(),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  },
  {
    examples: [
      {
        _id: "6ab3f0c2a1b2c3d4e5f60718",
        id: "6ab3f0c2a1b2c3d4e5f60718",
        imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/show-company/quince-vivo.jpg",
        publicId: "show-company/quince-vivo",
        alt: "Quinceañera con personajes en vivo",
        category: "quinceaneras",
        categoryLabel: "Quinceaños",
        label: "Producción de fantasía con personajes dorados",
        order: 0,
        createdAt: "2026-09-20T18:00:00.000Z",
        updatedAt: "2026-09-20T18:00:00.000Z",
      },
    ],
  }
);

export const SolicitudSchema = t.Object(
  {
    _id: t.String(),
    id: t.String(),
    nombre: t.String(),
    telefono: t.String(),
    correo: t.String(),
    tipoEvento: t.Optional(t.String()),
    mensaje: t.Optional(t.String()),
    origen: literals(SOLICITUD_ORIGENES),
    detalleCotizador: t.Optional(
      t.Record(t.String(), t.Unknown(), {
        description: "Lo seleccionado en el cotizador (personajes, cantidades, total). Solo cuando origen = cotizador.",
      })
    ),
    estado: literals(SOLICITUD_ESTADOS),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  },
  {
    examples: [
      {
        _id: "6ab4600a9f8e7d6c5b4a3921",
        id: "6ab4600a9f8e7d6c5b4a3921",
        nombre: "Ana López",
        telefono: "5555-1234",
        correo: "ana@example.com",
        tipoEvento: "Quinceaños",
        origen: "cotizador",
        detalleCotizador: {
          personajes: [{ nombre: "Batucada Hora Loca — 3 Tamboreros", cantidad: 2, subtotal: 7600 }],
          total: 7600,
        },
        estado: "nuevo",
        createdAt: "2026-09-23T20:15:00.000Z",
        updatedAt: "2026-09-23T20:15:00.000Z",
      },
    ],
  }
);

// Rutas admin: requieren "Authorization: Bearer <token>" (se obtiene en /api/auth/login).
export const adminDetail = { tags: ["Admin"], security: [{ bearerAuth: [] }] };
