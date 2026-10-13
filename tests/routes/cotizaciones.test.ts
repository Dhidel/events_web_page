import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import mongoose, { Types } from "mongoose";
import { errorHandler } from "../../src/lib/errors";
import { Servicio } from "../../src/models/Servicio";
import { Solicitud } from "../../src/models/Solicitud";
import { cotizacionesRoutes } from "../../src/routes/cotizaciones";
import { sembrarServicios } from "../../src/scripts/seed-servicios";

// La ruta real con el mismo manejador de errores que usa el servidor (src/index.ts).
const app = new Elysia().use(errorHandler).use(cotizacionesRoutes);

function post(body: unknown) {
  return app.handle(
    new Request("http://localhost/api/cotizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const contacto = { nombre: "Ana López", telefono: "5555-1234", correo: "ana@example.com" };

type Linea = { servicioId: string; nombre: string; cantidad: number; precioUnitario: number; subtotal: number };
type Detalle = { personajes: Linea[]; total: number };

describe("POST /api/cotizaciones — cotizador: el servidor recalcula el estimado", () => {
  let batucadaId: string;
  let zanqueroId: string;

  beforeEach(async () => {
    const [batucada, zanquero] = await Servicio.create([
      { nombre: "Batucada 3 Tamboreros", descripcion: "x", categoria: "Batucadas", precio: 3800 },
      { nombre: "Zanquero Iluminado", descripcion: "x", categoria: "Zanqueros", precio: 2500 },
    ]);
    batucadaId = batucada!.id;
    zanqueroId = zanquero!.id;
  });

  const cotizacion = (personajes: unknown[], total?: number) => ({
    ...contacto,
    origen: "cotizador",
    detalleCotizador: { personajes, total },
  });

  test("un total falso se ignora: se guarda el calculado con los precios de MongoDB", async () => {
    const res = await post(
      cotizacion(
        [
          { servicioId: batucadaId, nombre: "Gratis", cantidad: 2, subtotal: 1 },
          { servicioId: zanqueroId, nombre: "Gratis", cantidad: 1, subtotal: 1 },
        ],
        1 // total manipulado
      )
    );
    expect(res.status).toBe(201);

    const esperado: Detalle = {
      personajes: [
        { servicioId: batucadaId, nombre: "Batucada 3 Tamboreros", cantidad: 2, precioUnitario: 3800, subtotal: 7600 },
        { servicioId: zanqueroId, nombre: "Zanquero Iluminado", cantidad: 1, precioUnitario: 2500, subtotal: 2500 },
      ],
      total: 10100,
    };

    const body = (await res.json()) as { id: string; detalleCotizador: Detalle };
    expect(body.detalleCotizador).toEqual(esperado);

    const guardada = await Solicitud.findById(body.id).lean();
    expect(guardada!.detalleCotizador).toEqual(esperado);
  });

  test("usa el precio vigente en MongoDB aunque el cliente haya calculado con otro", async () => {
    await Servicio.updateOne({ _id: batucadaId }, { precio: 4000 });

    const res = await post(cotizacion([{ servicioId: batucadaId, cantidad: 1, subtotal: 3800 }], 3800));
    const body = (await res.json()) as { detalleCotizador: Detalle };
    expect(body.detalleCotizador.total).toBe(4000);
  });

  test("descarta las líneas con cantidad 0", async () => {
    const res = await post(
      cotizacion([
        { servicioId: batucadaId, cantidad: 0 },
        { servicioId: zanqueroId, cantidad: 3 },
      ])
    );
    const body = (await res.json()) as { detalleCotizador: Detalle };
    expect(body.detalleCotizador.personajes.map((p) => p.servicioId)).toEqual([zanqueroId]);
    expect(body.detalleCotizador.total).toBe(7500);
  });

  test.each([
    ["mayor a 20", 21],
    ["negativa", -1],
    ["con decimales", 1.5],
  ])("rechaza una cantidad %s (422) y no guarda nada", async (_caso, cantidad) => {
    const res = await post(cotizacion([{ servicioId: batucadaId, cantidad }]));
    expect(res.status).toBe(422);
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("rechaza un servicio que no existe", async () => {
    const res = await post(cotizacion([{ servicioId: new Types.ObjectId().toString(), cantidad: 1 }]));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Uno de los personajes seleccionados ya no está disponible." });
  });

  test("rechaza un servicio inactivo", async () => {
    await Servicio.updateOne({ _id: zanqueroId }, { activo: false });
    const res = await post(cotizacion([{ servicioId: zanqueroId, cantidad: 1 }]));
    expect(res.status).toBe(422);
  });

  test("rechaza una cotización sin personajes (todo en 0)", async () => {
    const res = await post(cotizacion([{ servicioId: batucadaId, cantidad: 0 }]));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Selecciona al menos un personaje." });
  });

  test("rechaza el mismo servicio repetido (evita saltarse el máximo de 20)", async () => {
    const res = await post(
      cotizacion([
        { servicioId: batucadaId, cantidad: 20 },
        { servicioId: batucadaId, cantidad: 20 },
      ])
    );
    expect(res.status).toBe(422);
  });

  test("rechaza origen cotizador sin detalle", async () => {
    const res = await post({ ...contacto, origen: "cotizador" });
    expect(res.status).toBe(422);
  });

  test("con origen contacto, un detalle enviado se descarta", async () => {
    const res = await post({
      ...contacto,
      origen: "contacto",
      detalleCotizador: { personajes: [{ servicioId: batucadaId, cantidad: 1 }], total: 1 },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    const guardada = await Solicitud.findById(body.id).lean();
    expect(guardada!.detalleCotizador).toBeUndefined();
  });
});

describe("POST /api/cotizaciones — fechaEvento", () => {
  test("guarda la fecha del evento y la devuelve", async () => {
    const res = await post({ ...contacto, origen: "contacto", fechaEvento: "2026-12-05" });
    expect(res.status).toBe(201);

    const body = (await res.json()) as { id: string; fechaEvento: string };
    expect(body.fechaEvento).toBe("2026-12-05");
    const guardada = await Solicitud.findById(body.id).lean();
    expect(guardada!.fechaEvento).toBe("2026-12-05");
  });

  test("es opcional", async () => {
    const res = await post({ ...contacto, origen: "contacto" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { fechaEvento?: string };
    expect(body.fechaEvento).toBeUndefined();
  });

  test.each(["05/12/2026", "2026-02-31", "mañana"])("rechaza una fecha inválida: %s", async (fechaEvento) => {
    const res = await post({ ...contacto, origen: "contacto", fechaEvento });
    expect(res.status).toBe(422);
    expect(await Solicitud.countDocuments()).toBe(0);
  });
});

describe("POST /api/cotizaciones — MongoDB caído", () => {
  test("responde 500 con un mensaje genérico (el frontend ofrece reintentar)", async () => {
    await mongoose.disconnect();
    // Sin conexión, Mongoose encola la operación y falla al vencer este tiempo (10 s por defecto).
    mongoose.set("bufferTimeoutMS", 300);
    try {
      const res = await post({ ...contacto, origen: "contacto" });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Ocurrió un error, intenta de nuevo." });
    } finally {
      mongoose.set("bufferTimeoutMS", 10_000);
      await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: "events_test" });
    }
  });
});

describe("POST /api/cotizaciones — spam y duplicados", () => {
  const solicitud = { ...contacto, origen: "contacto", mensaje: "Quiero cotizar una boda" };

  function postDesde(ip: string, body: unknown) {
    return app.handle(
      new Request("http://localhost/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
      })
    );
  }

  test("la misma solicitud enviada dos veces se guarda una sola vez (y devuelve la misma)", async () => {
    const primera = (await (await post(solicitud)).json()) as { id: string };
    const segunda = await post(solicitud);
    expect(segunda.status).toBe(201);
    expect(((await segunda.json()) as { id: string }).id).toBe(primera.id);
    expect(await Solicitud.countDocuments()).toBe(1);
  });

  test("la misma cotización del cotizador tampoco se duplica", async () => {
    const servicio = await Servicio.create({ nombre: "Zanquero", descripcion: "x", categoria: "Zanqueros", precio: 2500 });
    const cotizacion = { ...contacto, origen: "cotizador", detalleCotizador: { personajes: [{ servicioId: servicio.id, cantidad: 2 }] } };
    await post(cotizacion);
    await post(cotizacion);
    expect(await Solicitud.countDocuments()).toBe(1);

    // Otra selección sí es otra cotización.
    await post({ ...cotizacion, detalleCotizador: { personajes: [{ servicioId: servicio.id, cantidad: 3 }] } });
    expect(await Solicitud.countDocuments()).toBe(2);
  });

  test("un dato distinto (otro mensaje, otro teléfono) sí crea otra solicitud", async () => {
    await post(solicitud);
    await post({ ...solicitud, mensaje: "Otra consulta" });
    await post({ ...solicitud, telefono: "4444-1234" });
    expect(await Solicitud.countDocuments()).toBe(3);
  });

  test("una solicitud idéntica pero vieja (fuera de la ventana) sí se guarda de nuevo", async () => {
    const primera = (await (await post(solicitud)).json()) as { id: string };
    await Solicitud.collection.updateOne(
      { _id: new Types.ObjectId(primera.id as string) },
      { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } }
    );
    await post(solicitud);
    expect(await Solicitud.countDocuments()).toBe(2);
  });

  test("más de 5 envíos seguidos desde la misma IP responden 429; otra IP no se ve afectada", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await postDesde("203.0.113.50", { ...solicitud, mensaje: `Consulta ${i}` })).status).toBe(201);
    }
    const bloqueada = await postDesde("203.0.113.50", { ...solicitud, mensaje: "Consulta 6" });
    expect(bloqueada.status).toBe(429);
    expect(((await bloqueada.json()) as { error: string }).error).toContain("Espera unos minutos");
    expect(await Solicitud.countDocuments()).toBe(5);

    expect((await postDesde("203.0.113.51", { ...solicitud, mensaje: "Desde otra IP" })).status).toBe(201);
  });
});

describe("POST /api/cotizaciones — detalles de entrada", () => {
  test("una cantidad enviada como texto (\"2\") se rechaza", async () => {
    const servicio = await Servicio.create({ nombre: "Zanquero", descripcion: "x", categoria: "Zanqueros", precio: 2500 });
    const res = await post({ ...contacto, origen: "cotizador", detalleCotizador: { personajes: [{ servicioId: servicio.id, cantidad: "2" }] } });
    expect(res.status).toBe(422);
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("un \"<\" suelto en el nombre o el mensaje se conserva; las etiquetas se quitan", async () => {
    const res = await post({
      nombre: "Juan <3 María",
      telefono: "5555-1234",
      correo: "juan@example.com",
      origen: "contacto",
      mensaje: "Somos < 50 invitados <b>aprox</b><!-- oculto --> y x > y",
    });
    expect(res.status).toBe(201);
    const guardada = (await res.json()) as { nombre: string; mensaje: string };
    expect(guardada.nombre).toBe("Juan <3 María");
    expect(guardada.mensaje).toBe("Somos < 50 invitados aprox y x > y");
  });
});

describe("POST /api/cotizaciones — batucadas temáticas y traslado fuera de la capital", () => {
  // Catálogo real del seed (incluye las 4 batucadas temáticas), en el MongoDB en memoria.
  let ids: Record<string, string>;

  beforeEach(async () => {
    await sembrarServicios();
    const docs = await Servicio.find().lean();
    ids = Object.fromEntries(docs.map((d) => [d.nombre, d._id.toString()]));
  });

  const cotizar = (personajes: { servicioId: string; cantidad: number }[], extra: Record<string, unknown> = {}) =>
    post({ ...contacto, origen: "cotizador", detalleCotizador: { personajes, ...extra } });

  test("total con una batucada temática: Q3,800 por 1 grupo (1 hora, 3 artistas)", async () => {
    const res = await cotizar([{ servicioId: ids["Batucada Temática Brasileña"]!, cantidad: 1 }]);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { detalleCotizador: Detalle };
    expect(body.detalleCotizador).toEqual({
      personajes: [
        {
          servicioId: ids["Batucada Temática Brasileña"]!,
          nombre: "Batucada Temática Brasileña",
          cantidad: 1,
          precioUnitario: 3800,
          subtotal: 3800,
        },
      ],
      total: 3800,
    });
  });

  test("total mezclando servicios: temáticas, Hora Loca y personajes", async () => {
    const res = await cotizar([
      { servicioId: ids["Batucada Temática Chapina"]!, cantidad: 2 }, // 7 600
      { servicioId: ids["Batucada Temática Colombiana"]!, cantidad: 1 }, // 3 800
      { servicioId: ids["Batucada Hora Loca — 6 Tamboreros"]!, cantidad: 1 }, // 6 500
      { servicioId: ids["Zanquero Iluminado"]!, cantidad: 3 }, // 7 500
      { servicioId: ids["Cabezones de Tus Artistas Favoritos"]!, cantidad: 2 }, // 3 600
    ]);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { detalleCotizador: Detalle };
    expect(body.detalleCotizador.personajes.map((p) => p.subtotal)).toEqual([7600, 3800, 6500, 7500, 3600]);
    expect(body.detalleCotizador.total).toBe(29000);
  });

  test("fuera de la capital: no suma al total y la marca queda guardada para ventas", async () => {
    const seleccion = [
      { servicioId: ids["Batucada Temática Dominicana"]!, cantidad: 1 },
      { servicioId: ids["Robots LED"]!, cantidad: 1 },
    ];
    const res = await cotizar(seleccion, { fueraDeCapital: true, total: 999999 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; detalleCotizador: Detalle & { fueraDeCapital?: boolean } };
    expect(body.detalleCotizador.total).toBe(6300);
    expect(body.detalleCotizador.fueraDeCapital).toBe(true);

    const guardada = await Solicitud.findById(body.id).lean();
    expect(guardada!.detalleCotizador).toMatchObject({ total: 6300, fueraDeCapital: true });
  });

  test("sin marcar (o false) no se guarda la marca, y el total es el mismo", async () => {
    const seleccion = [{ servicioId: ids["Batucada Temática Dominicana"]!, cantidad: 1 }];
    const res = await cotizar(seleccion, { fueraDeCapital: false });
    const body = (await res.json()) as { detalleCotizador: Record<string, unknown> };
    expect(body.detalleCotizador.total).toBe(3800);
    expect(body.detalleCotizador).not.toHaveProperty("fueraDeCapital");
  });

  test("la misma selección con y sin traslado son dos solicitudes distintas (no se toma como duplicado)", async () => {
    const seleccion = [{ servicioId: ids["Batucada Temática Chapina"]!, cantidad: 1 }];
    await cotizar(seleccion);
    await cotizar(seleccion, { fueraDeCapital: true });
    expect(await Solicitud.countDocuments()).toBe(2);
  });

  test.each([
    ["texto \"true\"", "true"],
    ["número 1", 1],
  ])("fueraDeCapital como %s se rechaza (422) y no se guarda nada", async (_caso, valor) => {
    const res = await cotizar([{ servicioId: ids["Batucada Temática Chapina"]!, cantidad: 1 }], { fueraDeCapital: valor });
    expect(res.status).toBe(422);
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("un campo extra junto a fueraDeCapital sigue respondiendo 422 ([14.1])", async () => {
    const res = await cotizar([{ servicioId: ids["Batucada Temática Chapina"]!, cantidad: 1 }], {
      fueraDeCapital: true,
      costoTraslado: 0,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Campos no permitidos: detalleCotizador.costoTraslado." });
  });
});
