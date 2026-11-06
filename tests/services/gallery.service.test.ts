import { describe, expect, test } from "bun:test";
import { Types } from "mongoose";
import { GalleryImage } from "../../src/models/GalleryImage";
import {
  actualizarImagenGaleria,
  crearImagenGaleria,
  eliminarImagenGaleria,
  listarImagenesGaleria,
  obtenerImagenPorId,
  type CrearImagenInput,
} from "../../src/services/gallery.service";

function datosImagen(overrides: Partial<CrearImagenInput> = {}): CrearImagenInput {
  return {
    imageUrl: "https://res.cloudinary.com/demo/image/upload/boda.jpg",
    publicId: "show-company/gallery/boda",
    alt: "Pareja en su boda",
    label: "Boda en Antigua",
    category: "bodas",
    ...overrides,
  };
}

const idInexistente = () => new Types.ObjectId().toString();

describe("crearImagenGaleria", () => {
  test("guarda la imagen y deriva la etiqueta de la categoría", async () => {
    const creada = await crearImagenGaleria(datosImagen({ order: 3 }));

    const guardada = await GalleryImage.findById(creada.id).lean();
    expect(guardada).not.toBeNull();
    expect(guardada!.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/boda.jpg");
    expect(guardada!.publicId).toBe("show-company/gallery/boda");
    expect(guardada!.alt).toBe("Pareja en su boda");
    expect(guardada!.label).toBe("Boda en Antigua");
    expect(guardada!.category).toBe("bodas");
    expect(guardada!.categoryLabel).toBe("Bodas");
    expect(guardada!.order).toBe(3);
  });

  test("usa order = 0 si no se indica", async () => {
    const creada = await crearImagenGaleria(datosImagen());
    expect(creada.order).toBe(0);
  });

  test("rechaza una categoría que no existe", async () => {
    await expect(
      crearImagenGaleria(datosImagen({ category: "cumpleanos" as CrearImagenInput["category"] }))
    ).rejects.toThrow();
    expect(await GalleryImage.countDocuments()).toBe(0);
  });
});

describe("listarImagenesGaleria", () => {
  test("devuelve una lista vacía si no hay imágenes", async () => {
    expect(await listarImagenesGaleria()).toEqual([]);
  });

  test("ordena por 'order' y, a igual orden, por fecha de creación", async () => {
    await crearImagenGaleria(datosImagen({ label: "C", order: 2 }));
    await crearImagenGaleria(datosImagen({ label: "A1", order: 1 }));
    await Bun.sleep(5);
    await crearImagenGaleria(datosImagen({ label: "A2", order: 1 }));
    await crearImagenGaleria(datosImagen({ label: "Z", order: 0 }));

    const lista = await listarImagenesGaleria();
    expect(lista.map((i) => i.label)).toEqual(["Z", "A1", "A2", "C"]);
  });
});

describe("obtenerImagenPorId", () => {
  test("devuelve la imagen cuando existe", async () => {
    const creada = await crearImagenGaleria(datosImagen());
    const encontrada = await obtenerImagenPorId(creada.id);
    expect(encontrada).not.toBeNull();
    expect(encontrada!.id).toBe(creada.id);
    expect(encontrada!.label).toBe("Boda en Antigua");
  });

  test("devuelve null si el id no existe", async () => {
    expect(await obtenerImagenPorId(idInexistente())).toBeNull();
  });
});

describe("actualizarImagenGaleria", () => {
  test("actualiza solo los campos enviados y los persiste", async () => {
    const creada = await crearImagenGaleria(datosImagen());

    const actualizada = await actualizarImagenGaleria(creada.id, { label: "Nueva etiqueta", order: 7 });
    expect(actualizada).not.toBeNull();

    const guardada = await GalleryImage.findById(creada.id).lean();
    expect(guardada!.label).toBe("Nueva etiqueta");
    expect(guardada!.order).toBe(7);
    // Lo que no se envió queda igual.
    expect(guardada!.alt).toBe("Pareja en su boda");
    expect(guardada!.category).toBe("bodas");
  });

  test("al cambiar la categoría también actualiza su etiqueta", async () => {
    const creada = await crearImagenGaleria(datosImagen());

    await actualizarImagenGaleria(creada.id, { category: "quinceaneras" });

    const guardada = await GalleryImage.findById(creada.id).lean();
    expect(guardada!.category).toBe("quinceaneras");
    expect(guardada!.categoryLabel).toBe("Quinceaños");
  });

  test("puede reemplazar la imagen (url y publicId)", async () => {
    const creada = await crearImagenGaleria(datosImagen());

    await actualizarImagenGaleria(creada.id, {
      imageUrl: "https://res.cloudinary.com/demo/image/upload/otra.jpg",
      publicId: "show-company/gallery/otra",
    });

    const guardada = await GalleryImage.findById(creada.id).lean();
    expect(guardada!.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/otra.jpg");
    expect(guardada!.publicId).toBe("show-company/gallery/otra");
  });

  test("devuelve null si el id no existe", async () => {
    expect(await actualizarImagenGaleria(idInexistente(), { label: "x" })).toBeNull();
  });
});

describe("eliminarImagenGaleria", () => {
  test("borra la imagen de la base y devuelve el documento borrado", async () => {
    const creada = await crearImagenGaleria(datosImagen());

    const eliminada = await eliminarImagenGaleria(creada.id);
    expect(eliminada).not.toBeNull();
    expect(eliminada!.publicId).toBe("show-company/gallery/boda");

    expect(await GalleryImage.findById(creada.id)).toBeNull();
  });

  test("devuelve null si el id no existe", async () => {
    await crearImagenGaleria(datosImagen());
    expect(await eliminarImagenGaleria(idInexistente())).toBeNull();
    // No borró nada más.
    expect(await GalleryImage.countDocuments()).toBe(1);
  });
});
