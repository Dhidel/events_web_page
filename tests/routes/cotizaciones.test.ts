import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import mongoose, { Types } from "mongoose";
import { errorHandler } from "../../src/lib/errors";
import { Servicio } from "../../src/models/Servicio";
import { Solicitud } from "../../src/models/Solicitud";
import { cotizacionesRoutes } from "../../src/routes/cotizaciones";

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
