import { describe, expect, test } from "bun:test";
import { Servicio } from "../../src/models/Servicio";
import { SERVICIOS_INICIALES, sembrarServicios } from "../../src/scripts/seed-servicios";

// El seed corre contra el MongoDB en memoria de tests/setup.ts (nunca contra Atlas).

const TEMATICAS = [
  "Batucada Temática Brasileña",
  "Batucada Temática Dominicana",
  "Batucada Temática Chapina",
  "Batucada Temática Colombiana",
];

describe("sembrarServicios (upsert por nombre)", () => {
  test("en una base vacía crea todo el catálogo, incluidas las 4 batucadas temáticas", async () => {
    const resultado = await sembrarServicios();
    expect(resultado).toEqual({ insertados: SERVICIOS_INICIALES.length, existentes: 0 });

    const tematicas = await Servicio.find({ nombre: { $in: TEMATICAS } }).lean();
    expect(tematicas).toHaveLength(4);
    for (const t of tematicas) {
      expect(t).toMatchObject({ categoria: "Batucadas", precio: 3800, unidad: "por hora", artistas: 3, activo: true });
      expect(t.descripcion).toMatch(/^Batucada temática \p{L}+\.$/u);
    }
  });

  test("correrlo dos veces no duplica nada", async () => {
    await sembrarServicios();
    const segunda = await sembrarServicios();

    expect(segunda).toEqual({ insertados: 0, existentes: SERVICIOS_INICIALES.length });
    expect(await Servicio.countDocuments()).toBe(SERVICIOS_INICIALES.length);
    // Ningún nombre repetido.
    const nombres = (await Servicio.find().lean()).map((s) => s.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  test("con el catálogo viejo ya cargado: agrega solo las temáticas y no pisa ningún precio", async () => {
    // Catálogo como está hoy en la base: sin temáticas y con precios editados a mano.
    const viejo = SERVICIOS_INICIALES.filter((s) => !TEMATICAS.includes(s.nombre)).map(({ artistas: _a, ...s }, orden) => ({
      ...s,
      precio: s.precio + 123,
      descripcion: `${s.descripcion} (editada)`,
      activo: true,
      orden,
    }));
    await Servicio.create(viejo);
    // Uno desactivado a propósito: el seed no lo reactiva.
    await Servicio.updateOne({ nombre: "Robots LED" }, { activo: false });
    const antes = await Servicio.find().lean();

    const resultado = await sembrarServicios();
    expect(resultado).toEqual({ insertados: 4, existentes: viejo.length });
    expect(await Servicio.countDocuments()).toBe(viejo.length + 4);

    for (const previo of antes) {
      const ahora = (await Servicio.findById(previo._id).lean())!;
      expect(ahora.precio).toBe(previo.precio);
      expect(ahora.descripcion).toBe(previo.descripcion);
      expect(ahora.activo).toBe(previo.activo);
    }
  });

  test("Hora Loca recibe `artistas` (3 y 6, del nombre) y las temáticas quedan justo después", async () => {
    await Servicio.create([
      { nombre: "Batucada Hora Loca — 3 Tamboreros", descripcion: "x", categoria: "Batucadas", precio: 3800, orden: 0 },
      { nombre: "Batucada Hora Loca — 6 Tamboreros", descripcion: "x", categoria: "Batucadas", precio: 6500, orden: 1 },
    ]);
    await sembrarServicios();

    const catalogo = await Servicio.find().sort({ orden: 1 }).lean();
    expect(catalogo.slice(0, 6).map((s) => [s.nombre, s.artistas])).toEqual([
      ["Batucada Hora Loca — 3 Tamboreros", 3],
      ["Batucada Hora Loca — 6 Tamboreros", 6],
      ...TEMATICAS.map((n) => [n, 3]),
    ]);
    // Los demás servicios no llevan `artistas`.
    expect(catalogo.slice(6).every((s) => s.artistas === undefined)).toBe(true);
  });
});
