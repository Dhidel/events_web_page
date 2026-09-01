import { Elysia, t } from "elysia";
import { adminGuard } from "../middleware/adminGuard";
import { GalleryImage, GALLERY_CATEGORIES, CATEGORY_LABELS } from "../models/GalleryImage";
import { uploadImage, deleteImage } from "../lib/cloudinary";

const categorySchema = t.Union(GALLERY_CATEGORIES.map((value) => t.Literal(value)));
const imageSchema = t.File({ type: "image", maxSize: "10m" });

// Sube una imagen a Cloudinary y traduce cualquier fallo (incl. "no configurado")
// en un error 502 con mensaje legible para el panel.
async function upload(file: File, set: { status?: number | string }) {
  try {
    return await uploadImage(file);
  } catch (error) {
    set.status = 502;
    throw new Error((error as Error).message);
  }
}

// Todas las rutas pasan por adminGuard (requiere JWT válido en Authorization: Bearer).
export const adminGalleryRoutes = new Elysia({ prefix: "/api/admin/gallery" })
  .use(adminGuard)
  .get("/", async () => {
    const items = await GalleryImage.find().sort({ order: 1, createdAt: 1 });
    return items.map((item) => item.toJSON());
  })
  .post(
    "/",
    async ({ body, set }) => {
      const { url, publicId } = await upload(body.image, set);

      const doc = await GalleryImage.create({
        imageUrl: url,
        publicId,
        alt: body.alt,
        label: body.label,
        category: body.category,
        categoryLabel: CATEGORY_LABELS[body.category],
        order: body.order ?? 0,
      });

      set.status = 201;
      return doc.toJSON();
    },
    {
      body: t.Object({
        image: imageSchema,
        alt: t.String({ minLength: 1 }),
        label: t.String({ minLength: 1 }),
        category: categorySchema,
        order: t.Optional(t.Numeric()),
      }),
    }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const doc = await GalleryImage.findById(params.id);
      if (!doc) {
        set.status = 404;
        return { error: "Imagen no encontrada." };
      }

      if (body.image) {
        const previousPublicId = doc.publicId;
        const { url, publicId } = await upload(body.image, set);
        doc.imageUrl = url;
        doc.publicId = publicId;
        // Se borra la anterior después de subir la nueva; si falla, no rompe la operación.
        deleteImage(previousPublicId).catch((error) =>
          console.error("Cloudinary: no se pudo borrar la imagen anterior:", error)
        );
      }

      if (body.alt !== undefined) doc.alt = body.alt;
      if (body.label !== undefined) doc.label = body.label;
      if (body.category !== undefined) {
        doc.category = body.category;
        doc.categoryLabel = CATEGORY_LABELS[body.category];
      }
      if (body.order !== undefined) doc.order = body.order;

      await doc.save();
      return doc.toJSON();
    },
    {
      body: t.Object({
        image: t.Optional(imageSchema),
        alt: t.Optional(t.String({ minLength: 1 })),
        label: t.Optional(t.String({ minLength: 1 })),
        category: t.Optional(categorySchema),
        order: t.Optional(t.Numeric()),
      }),
    }
  )
  .delete("/:id", async ({ params, set }) => {
    const doc = await GalleryImage.findById(params.id);
    if (!doc) {
      set.status = 404;
      return { error: "Imagen no encontrada." };
    }

    await deleteImage(doc.publicId).catch((error) =>
      console.error("Cloudinary: no se pudo borrar la imagen:", error)
    );
    await doc.deleteOne();

    return { ok: true };
  });
