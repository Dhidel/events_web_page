import { Elysia, t } from "elysia";
import { adminGuard } from "../middleware/adminGuard";
import { GALLERY_CATEGORIES, type GalleryCategory } from "../models/GalleryImage";
import { uploadImage, deleteImage } from "../lib/cloudinary";
import { adminDetail, errorResponses, GalleryImageSchema, IdParams, toApi } from "../lib/apiSchemas";
import { ApiError } from "../lib/errors";
import {
  listarImagenesGaleria,
  crearImagenGaleria,
  obtenerImagenPorId,
  actualizarImagenGaleria,
  eliminarImagenGaleria,
} from "../services/gallery.service";

const categorySchema = t.Union(GALLERY_CATEGORIES.map((value) => t.Literal(value)));
const imageSchema = t.File({ type: "image", maxSize: "10m" });

// Falla de Cloudinary (incl. "no configurado"): 502 con mensaje genérico. El detalle
// real (credenciales, configuración) queda solo en el log del servidor.
async function upload(file: File) {
  try {
    return await uploadImage(file);
  } catch (error) {
    console.error("Cloudinary: falló la subida:", error);
    throw new ApiError(502, "No se pudo procesar la imagen. Intenta de nuevo.");
  }
}

// Todas las rutas pasan por adminGuard (requiere JWT válido en Authorization: Bearer).
export const adminGalleryRoutes = new Elysia({ prefix: "/api/admin/gallery" })
  .use(adminGuard)
  .get(
    "/",
    async () => {
      const items = await listarImagenesGaleria();
      return items.map((item) => toApi(GalleryImageSchema, item));
    },
    {
      response: { 200: t.Array(GalleryImageSchema), ...errorResponses(401, 500) },
      detail: {
        ...adminDetail,
        summary: "Listar fotos de la galería (admin)",
        description: "Mismo contenido que GET /api/gallery, para el panel admin.",
      },
    }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const { url, publicId } = await upload(body.image);

      const doc = await crearImagenGaleria({
        imageUrl: url,
        publicId,
        alt: body.alt,
        label: body.label,
        category: body.category as GalleryCategory,
        order: body.order,
      });

      set.status = 201;
      return toApi(GalleryImageSchema, doc);
    },
    {
      // El panel envía FormData (la imagen es un archivo).
      parse: "formdata",
      body: t.Object({
        image: imageSchema,
        alt: t.String({ minLength: 1 }),
        label: t.String({ minLength: 1 }),
        category: categorySchema,
        order: t.Optional(t.Numeric()),
      }),
      response: { 201: GalleryImageSchema, ...errorResponses(400, 401, 422, 500, 502) },
      detail: {
        ...adminDetail,
        summary: "Subir una foto a la galería",
        description:
          "multipart/form-data. Sube la imagen (máx. 10 MB) a Cloudinary y la guarda en la galería. categoryLabel se deriva de category. 502 si Cloudinary falla.",
      },
    }
  )
  .put(
    "/:id",
    async ({ params, body }) => {
      const docExistente = await obtenerImagenPorId(params.id);
      if (!docExistente) throw new ApiError(404, "Imagen no encontrada.");

      let newImageUrl: string | undefined;
      let newPublicId: string | undefined;

      if (body.image) {
        const previousPublicId = docExistente.publicId;
        const uploaded = await upload(body.image);
        newImageUrl = uploaded.url;
        newPublicId = uploaded.publicId;

        // Se borra la anterior después de subir la nueva; si falla, no rompe la operación.
        deleteImage(previousPublicId).catch((error) =>
          console.error("Cloudinary: no se pudo borrar la imagen anterior:", error)
        );
      }

      const doc = await actualizarImagenGaleria(params.id, {
        imageUrl: newImageUrl,
        publicId: newPublicId,
        alt: body.alt,
        label: body.label,
        category: body.category as GalleryCategory | undefined,
        order: body.order,
      });

      return toApi(GalleryImageSchema, doc!);
    },
    {
      params: IdParams,
      // El panel envía FormData (la imagen es un archivo).
      parse: "formdata",
      body: t.Object({
        image: t.Optional(imageSchema),
        alt: t.Optional(t.String({ minLength: 1 })),
        label: t.Optional(t.String({ minLength: 1 })),
        category: t.Optional(categorySchema),
        order: t.Optional(t.Numeric()),
      }),
      response: { 200: GalleryImageSchema, ...errorResponses(400, 401, 404, 422, 500, 502) },
      detail: {
        ...adminDetail,
        summary: "Editar una foto de la galería",
        description:
          "multipart/form-data. Todos los campos son opcionales; solo se cambia lo que se envía. Si se envía una imagen nueva, reemplaza a la anterior en Cloudinary.",
      },
    }
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const doc = await obtenerImagenPorId(params.id);
      if (!doc) throw new ApiError(404, "Imagen no encontrada.");

      await deleteImage(doc.publicId).catch((error) =>
        console.error("Cloudinary: no se pudo borrar la imagen:", error)
      );
      await eliminarImagenGaleria(params.id);

      return { ok: true };
    },
    {
      params: IdParams,
      response: {
        200: t.Object({ ok: t.Boolean() }, { examples: [{ ok: true }] }),
        ...errorResponses(401, 404, 422, 500),
      },
      detail: {
        ...adminDetail,
        summary: "Borrar una foto de la galería",
        description: "Borra la foto de la galería y de Cloudinary.",
      },
    }
  );
