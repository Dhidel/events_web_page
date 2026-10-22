import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { errorHandler } from "../../src/lib/errors";
import { AdminUser } from "../../src/models/AdminUser";
import { GalleryImage } from "../../src/models/GalleryImage";
import { Servicio } from "../../src/models/Servicio";
import { Solicitud } from "../../src/models/Solicitud";
import { adminCotizacionesRoutes } from "../../src/routes/adminCotizaciones";
import { adminGalleryRoutes } from "../../src/routes/adminGallery";
import { authRoutes } from "../../src/routes/auth";
import { cotizacionesRoutes } from "../../src/routes/cotizaciones";
import { galleryRoutes } from "../../src/routes/gallery";
import { serviciosRoutes } from "../../src/routes/servicios";
import { cloudinaryFalso } from "../helpers/cloudinaryFalso";
import { asegurarAdminDePrueba, tokenDeAdminDePrueba } from "../helpers/adminDePrueba";

// [14.1] Validación global: al menos una petición inválida por endpoint que recibe datos.
// Todas deben responder { error: "mensaje sencillo" } sin detalles internos de validación.

const app = new Elysia()
  .use(errorHandler)
  .use(authRoutes)
  .use(serviciosRoutes)
  .use(galleryRoutes)
  .use(cotizacionesRoutes)
  .use(adminCotizacionesRoutes)
  .use(adminGalleryRoutes);

let AUTH: Record<string, string>;
beforeAll(async () => {
  AUTH = { Authorization: `Bearer ${await tokenDeAdminDePrueba()}` };
});
beforeEach(asegurarAdminDePrueba);

type Body = Record<string, unknown> | FormData | undefined;
function pedir(metodo: string, ruta: string, body?: Body, headers: Record<string, string> = {}) {
  const init: RequestInit = { method: metodo, headers: { ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return app.handle(new Request(`http://localhost${ruta}`, init));
}

function formulario(campos: Record<string, string | File>) {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries(campos)) fd.append(clave, valor);
  return fd;
}

// Formato único y sin fugas: solo { error }, un texto corto, sin rastros del validador ni de Mongo.
const FUGAS = /expected|schema|property|instancePath|\$ne|ValidationError|CastError|mongoose|mongo|stack|at \w+ \(/i;
async function esperarError(res: Response, status: number, mensaje?: string | RegExp) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as Record<string, unknown>;
  expect(Object.keys(body)).toEqual(["error"]);
  expect(typeof body.error).toBe("string");
  expect(body.error as string).not.toMatch(FUGAS);
  expect((body.error as string).length).toBeLessThan(160);
  if (mensaje !== undefined) expect(body.error as string).toMatch(mensaje);
}

const largo = (n: number) => "x".repeat(n);
const ID_INEXISTENTE = new Types.ObjectId().toString();

// Imágenes de prueba (bytes reales: Elysia revisa el contenido, no solo el tipo declarado).
const JPG = await Bun.file(new URL("../../client/src/assets/img/navidad.jpg", import.meta.url)).arrayBuffer();
const PNG = await Bun.file(new URL("../../client/src/assets/img/logo.png", import.meta.url)).arrayBuffer();
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64"); // 1×1
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"); // 1×1
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
const jpg = (nombre = "foto.jpg") => new File([JPG], nombre, { type: "image/jpeg" });

// ---------------------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await AdminUser.create({ email: "admin@example.com", password: "clave-correcta-123", name: "Admin" });
  });

  const login = (body: Record<string, unknown>) => pedir("POST", "/api/auth/login", body);

  test("credenciales válidas siguen funcionando (200 + token)", async () => {
    const res = await login({ email: "  Admin@Example.com ", password: "clave-correcta-123" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { token: string }).token).toBeString();
  });

  test('inyección NoSQL {"$ne": null} en email y password → 422', async () => {
    await esperarError(await login({ email: { $ne: null }, password: { $ne: null } }), 422);
  });

  test('inyección {"$gt": ""} solo en password → 422', async () => {
    await esperarError(await login({ email: "admin@example.com", password: { $gt: "" } }), 422);
  });

  test("tipo incorrecto (email numérico) → 422", async () => {
    await esperarError(await login({ email: 12345, password: "x" }), 422);
  });

  test("campo faltante (sin password) → 422", async () => {
    await esperarError(await login({ email: "admin@example.com" }), 422, /password/);
  });

  test("email de más de 254 caracteres → 422", async () => {
    await esperarError(await login({ email: `${largo(250)}@x.co`, password: "x" }), 422);
  });

  test("password de más de 200 caracteres → 422", async () => {
    await esperarError(await login({ email: "admin@example.com", password: largo(201) }), 422);
  });

  test("campo extra → 422 'Campos no permitidos'", async () => {
    await esperarError(
      await login({ email: "admin@example.com", password: "clave-correcta-123", rol: "superadmin" }),
      422,
      "Campos no permitidos: rol."
    );
  });

  test("correo mal formado → el mismo 401 genérico que credenciales incorrectas", async () => {
    await esperarError(await login({ email: "no-es-un-correo", password: "x" }), 401, "Correo o contraseña incorrectos.");
  });

  test("contraseña vacía → 401 genérico", async () => {
    await esperarError(await login({ email: "admin@example.com", password: "" }), 401, "Correo o contraseña incorrectos.");
  });

  test("contraseña incorrecta → 401 genérico", async () => {
    await esperarError(await login({ email: "admin@example.com", password: "otra" }), 401, "Correo o contraseña incorrectos.");
  });

  test("JSON roto → 400", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"email": "a@b.co",',
      })
    );
    await esperarError(res, 400);
  });
});

// ---------------------------------------------------------------------------------------

describe("POST /api/cotizaciones", () => {
  const contacto = { nombre: "Ana López", telefono: "5555-1234", correo: "ana@example.com", origen: "contacto" };
  const enviar = (body: Record<string, unknown>) => pedir("POST", "/api/cotizaciones", body);

  test("una solicitud válida sigue funcionando (201)", async () => {
    expect((await enviar(contacto)).status).toBe(201);
  });

  test("tipo incorrecto (nombre numérico) → 422", async () => {
    await esperarError(await enviar({ ...contacto, nombre: 123 }), 422, /nombre/);
  });

  test("campo faltante (sin correo) → 422", async () => {
    const { correo: _, ...sinCorreo } = contacto;
    await esperarError(await enviar(sinCorreo), 422, /correo/);
  });

  test("mensaje de más de 2000 caracteres → 422", async () => {
    await esperarError(await enviar({ ...contacto, mensaje: largo(2001) }), 422, /mensaje/);
  });

  test('nombre de solo espacios → 422 (antes llegaba a Mongo y daba 500)', async () => {
    await esperarError(await enviar({ ...contacto, nombre: "     " }), 422, /nombre/);
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("nombre que queda vacío al quitarle el HTML → 422 (no 500)", async () => {
    await esperarError(await enviar({ ...contacto, nombre: "<b></b>" }), 422, /nombre/);
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("origen fuera de la lista → 422", async () => {
    await esperarError(await enviar({ ...contacto, origen: "whatsapp" }), 422, /origen/);
  });

  test('inyección {"$ne": null} en correo → 422', async () => {
    await esperarError(await enviar({ ...contacto, correo: { $ne: null } }), 422);
  });

  test("campo extra en la raíz → 422", async () => {
    await esperarError(await enviar({ ...contacto, estado: "confirmado" }), 422, "Campos no permitidos: estado.");
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("campo extra dentro de detalleCotizador.personajes → 422", async () => {
    const res = await enviar({
      ...contacto,
      origen: "cotizador",
      detalleCotizador: {
        personajes: [{ servicioId: ID_INEXISTENTE, cantidad: 1, precioUnitario: 1 }],
        total: 1,
      },
    });
    await esperarError(res, 422, "Campos no permitidos: detalleCotizador.personajes[0].precioUnitario.");
  });
});

// ---------------------------------------------------------------------------------------

describe("GET /api/servicios", () => {
  beforeEach(async () => {
    await Servicio.create([
      { nombre: "Batucada", descripcion: "x", categoria: "Batucadas", precio: 3800 },
      { nombre: "Zanquero", descripcion: "x", categoria: "Zanqueros", precio: 2500 },
    ]);
  });

  test("categoría válida sigue filtrando (200)", async () => {
    const res = await pedir("GET", "/api/servicios?categoria=Zanqueros");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { nombre: string }[]).map((s) => s.nombre)).toEqual(["Zanquero"]);
  });

  test("sin filtro devuelve todo (200)", async () => {
    const res = await pedir("GET", "/api/servicios");
    expect(((await res.json()) as unknown[]).length).toBe(2);
  });

  test("categoría fuera de la lista del modelo → 422", async () => {
    await esperarError(await pedir("GET", "/api/servicios?categoria=NoExiste"), 422, /categoria/);
  });

  test("categoría de 10.000 caracteres → 422", async () => {
    await esperarError(await pedir("GET", `/api/servicios?categoria=${largo(10000)}`), 422);
  });

  test("?categoria[$ne]=x no inyecta: la clave se ignora y no se aplica ningún filtro", async () => {
    const res = await pedir("GET", "/api/servicios?categoria[$ne]=Zanqueros");
    expect(res.status).toBe(200);
    // Si fuera un filtro {$ne: "Zanqueros"} devolvería 1; devuelve todo porque no hay filtro.
    expect(((await res.json()) as unknown[]).length).toBe(2);
  });
});

describe("GET /api/gallery", () => {
  test("parámetros de query desconocidos o con operadores se ignoran (200)", async () => {
    const res = await pedir("GET", "/api/gallery?category[$ne]=bodas&utm_source=instagram");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------------------

describe("Rutas admin sin token", () => {
  test.each([
    ["GET", "/api/admin/cotizaciones", undefined],
    ["PATCH", `/api/admin/cotizaciones/${ID_INEXISTENTE}`, { estado: "contactado" }],
    ["POST", "/api/admin/gallery", formulario({ alt: "a", label: "b", category: "bodas" })],
    ["DELETE", `/api/admin/gallery/${ID_INEXISTENTE}`, undefined],
  ] as [string, string, Body][])("%s %s → 401", async (metodo, ruta, body) => {
    await esperarError(await pedir(metodo, ruta, body), 401, "No autorizado.");
  });

  // La sesión se revisa antes que el body: a un anónimo no se le describe el esquema.
  test("sin token, un body inválido o con campos extra responde 401 (no 422)", async () => {
    await esperarError(await pedir("PATCH", "/api/admin/cotizaciones/no-es-id", { estado: "x", extra: 1 }), 401, "No autorizado.");
    await esperarError(await pedir("POST", "/api/admin/gallery", formulario({ campoRaro: "1" })), 401, "No autorizado.");
  });

  test("con un token inválido o vencido → 401", async () => {
    const res = await pedir("GET", "/api/admin/cotizaciones", undefined, { Authorization: "Bearer token.falso.123" });
    await esperarError(res, 401, "No autorizado.");
  });
});

describe("GET /api/admin/cotizaciones", () => {
  test("sin ?estado devuelve todas (el query ausente no se rellena con un valor por defecto)", async () => {
    await Solicitud.create([
      { nombre: "A", telefono: "5555-1234", correo: "a@b.co", origen: "contacto" },
      { nombre: "B", telefono: "5555-1234", correo: "b@b.co", origen: "contacto", estado: "confirmado" },
    ]);
    const res = await pedir("GET", "/api/admin/cotizaciones", undefined, AUTH);
    expect(((await res.json()) as unknown[]).length).toBe(2);
  });

  test("estado válido sigue funcionando (200)", async () => {
    expect((await pedir("GET", "/api/admin/cotizaciones?estado=nuevo", undefined, AUTH)).status).toBe(200);
  });

  test("estado fuera de la lista → 422", async () => {
    await esperarError(await pedir("GET", "/api/admin/cotizaciones?estado=borrado", undefined, AUTH), 422, /estado/);
  });

  test("?estado[$ne]=nuevo no inyecta: la clave se ignora", async () => {
    await Solicitud.create({ nombre: "A", telefono: "5555-1234", correo: "a@b.co", origen: "contacto" });
    const res = await pedir("GET", "/api/admin/cotizaciones?estado[$ne]=nuevo", undefined, AUTH);
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBe(1);
  });
});

describe("PATCH /api/admin/cotizaciones/:id", () => {
  let id: string;
  beforeEach(async () => {
    id = (await Solicitud.create({ nombre: "A", telefono: "5555-1234", correo: "a@b.co", origen: "contacto" })).id;
  });
  const patch = (ruta: string, body: Record<string, unknown>) =>
    pedir("PATCH", `/api/admin/cotizaciones/${ruta}`, body, AUTH);

  test("cambio válido sigue funcionando (200)", async () => {
    expect((await patch(id, { estado: "contactado" })).status).toBe(200);
  });

  test("ObjectId mal formado → 422 antes de consultar la base", async () => {
    await esperarError(await patch("no-es-un-id", { estado: "contactado" }), 422, "El id no es válido.");
  });

  test.each(["123", `${ID_INEXISTENTE}0`, "zzzzzzzzzzzzzzzzzzzzzzzz"])("ObjectId inválido %s → 422", async (malo) => {
    await esperarError(await patch(malo, { estado: "contactado" }), 422, "El id no es válido.");
  });

  test("estado fuera de la lista → 422", async () => {
    await esperarError(await patch(id, { estado: "cancelado" }), 422, /estado/);
  });

  test('inyección {"$ne": 1} en estado → 422', async () => {
    await esperarError(await patch(id, { estado: { $ne: 1 } }), 422);
  });

  test("campo faltante (body vacío) → 422", async () => {
    await esperarError(await patch(id, {}), 422, /estado/);
  });

  test("campo extra → 422 y no modifica nada", async () => {
    await esperarError(await patch(id, { estado: "confirmado", nombre: "hackeado" }), 422, "Campos no permitidos: nombre.");
    const guardada = await Solicitud.findById(id).lean();
    expect(guardada!.estado).toBe("nuevo");
    expect(guardada!.nombre).toBe("A");
  });

  test("id con formato válido pero inexistente → 404", async () => {
    await esperarError(await patch(ID_INEXISTENTE, { estado: "contactado" }), 404);
  });
});

// ---------------------------------------------------------------------------------------

describe("POST /api/admin/gallery", () => {
  const base = { alt: "Pareja en su boda", label: "Boda en Antigua", category: "bodas" };
  const subir = (campos: Record<string, string | File>) =>
    pedir("POST", "/api/admin/gallery", formulario(campos), AUTH);

  test.each([
    ["JPG", () => jpg()],
    ["PNG", () => new File([PNG], "logo.png", { type: "image/png" })],
    ["WebP", () => new File([WEBP], "foto.webp", { type: "image/webp" })],
  ])("%s válido sigue funcionando (201)", async (_tipo, archivo) => {
    const res = await subir({ ...base, image: archivo() });
    expect(res.status).toBe(201);
    expect(cloudinaryFalso.subidas).toHaveLength(1);
  });

  test("quita espacios y HTML de alt y label antes de guardar", async () => {
    const res = await subir({ ...base, image: jpg(), alt: "  Pareja <b>feliz</b>  ", label: "<script>alert(1)</script>Boda" });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const guardada = await GalleryImage.findById(id).lean();
    expect(guardada!.alt).toBe("Pareja feliz");
    expect(guardada!.label).toBe("Boda");
  });

  test("campo faltante (sin imagen) → 422", async () => {
    await esperarError(await subir(base), 422, /image/);
  });

  test("archivo de texto → 422", async () => {
    await esperarError(await subir({ ...base, image: new File(["hola"], "a.txt", { type: "text/plain" }) }), 422);
  });

  test("SVG (puede llevar scripts) → 422", async () => {
    await esperarError(await subir({ ...base, image: new File([SVG], "a.svg", { type: "image/svg+xml" }) }), 422);
  });

  test("GIF → 422", async () => {
    await esperarError(await subir({ ...base, image: new File([GIF], "a.gif", { type: "image/gif" }) }), 422);
  });

  test("texto disfrazado de PNG (tipo declarado falso) → 422", async () => {
    await esperarError(
      await subir({ ...base, image: new File(["no soy una imagen"], "a.png", { type: "image/png" }) }),
      422,
      "El archivo debe ser una imagen JPG, PNG o WebP."
    );
  });

  test("GIF disfrazado de JPG → 422", async () => {
    await esperarError(await subir({ ...base, image: new File([GIF], "a.jpg", { type: "image/jpeg" }) }), 422);
  });

  test("imagen de más de 10 MB → 422", async () => {
    const grande = new File([JPG, new Uint8Array(10 * 1024 * 1024)], "grande.jpg", { type: "image/jpeg" });
    await esperarError(await subir({ ...base, image: grande }), 422);
  });

  test("alt de más de 200 caracteres → 422", async () => {
    await esperarError(await subir({ ...base, image: jpg(), alt: largo(201) }), 422, /alt/);
  });

  test("label de solo espacios → 422", async () => {
    await esperarError(await subir({ ...base, image: jpg(), label: "    " }), 422, /label/);
  });

  test("alt que queda vacío al quitarle el HTML → 422 sin subir nada a Cloudinary", async () => {
    await esperarError(await subir({ ...base, image: jpg(), alt: "<b></b>" }), 422, /alt/);
    expect(cloudinaryFalso.subidas).toHaveLength(0);
  });

  test("categoría fuera de la lista → 422", async () => {
    await esperarError(await subir({ ...base, image: jpg(), category: "cumpleanos" }), 422, /category/);
  });

  test("order no numérico → 422", async () => {
    await esperarError(await subir({ ...base, image: jpg(), order: "primero" }), 422, /order/);
  });

  test("campo extra → 422 sin subir nada", async () => {
    await esperarError(await subir({ ...base, image: jpg(), publicId: "otro/id" }), 422, "Campos no permitidos: publicId.");
    expect(cloudinaryFalso.subidas).toHaveLength(0);
  });
});

describe("PUT /api/admin/gallery/:id", () => {
  let id: string;
  beforeEach(async () => {
    id = (
      await GalleryImage.create({
        imageUrl: "https://res.cloudinary.com/falso/a.jpg",
        publicId: "falso/a",
        alt: "Original",
        label: "Original",
        category: "bodas",
        categoryLabel: "Bodas",
      })
    ).id;
  });
  const editar = (ruta: string, campos: Record<string, string | File>) =>
    pedir("PUT", `/api/admin/gallery/${ruta}`, formulario(campos), AUTH);

  test("edición válida sigue funcionando y sanitiza (200)", async () => {
    const res = await editar(id, { label: " <i>Nuevo</i> título ", alt: "Original", category: "bodas", order: "2" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { label: string }).label).toBe("Nuevo título");
  });

  test("ObjectId mal formado → 422", async () => {
    await esperarError(await editar("abc", { label: "x" }), 422, "El id no es válido.");
  });

  test("label de más de 150 caracteres → 422", async () => {
    await esperarError(await editar(id, { label: largo(151) }), 422, /label/);
  });

  test("imagen de reemplazo con tipo no permitido → 422", async () => {
    await esperarError(await editar(id, { image: new File([GIF], "a.gif", { type: "image/gif" }) }), 422);
    expect(cloudinaryFalso.subidas).toHaveLength(0);
  });

  test("campo extra → 422 y no modifica nada", async () => {
    await esperarError(await editar(id, { label: "Nuevo", imageUrl: "https://malo.example/x.jpg" }), 422, /imageUrl/);
    expect((await GalleryImage.findById(id).lean())!.label).toBe("Original");
  });

  test("id con formato válido pero inexistente → 404", async () => {
    await esperarError(await editar(ID_INEXISTENTE, { label: "x" }), 404);
  });
});

describe("DELETE /api/admin/gallery/:id", () => {
  test("ObjectId mal formado → 422", async () => {
    await esperarError(await pedir("DELETE", "/api/admin/gallery/abc", undefined, AUTH), 422, "El id no es válido.");
  });

  test("id inexistente → 404 sin borrar nada en Cloudinary", async () => {
    await esperarError(await pedir("DELETE", `/api/admin/gallery/${ID_INEXISTENTE}`, undefined, AUTH), 404);
    expect(cloudinaryFalso.borradas).toHaveLength(0);
  });
});
