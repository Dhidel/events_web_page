import { beforeEach, describe, expect, test } from "bun:test";
import { Types } from "mongoose";
import { Servicio } from "../../src/models/Servicio";
import {
  calcularEstimado,
  MAX_CANTIDAD_POR_SERVICIO,
  recalcularDetalleCotizador,
  SeleccionInvalidaError,
  type ServicioConPrecio,
} from "../../src/services/cotizador.service";

// Catálogo fijo para las pruebas del cálculo puro (no toca MongoDB).
const BATUCADA: ServicioConPrecio = { id: "batucada", nombre: "Batucada 3 Tamboreros", precio: 3800 };
const ZANQUERO: ServicioConPrecio = { id: "zanquero", nombre: "Zanquero Iluminado", precio: 2500 };
const CABEZONES: ServicioConPrecio = { id: "cabezones", nombre: "Cabezones", precio: 1800 };
const CATALOGO = [BATUCADA, ZANQUERO, CABEZONES];

describe("calcularEstimado (cálculo puro)", () => {
  describe("selección vacía", () => {
    // No devuelve total 0: una cotización sin personajes es inválida (la API responde 422).
    test("sin personajes lanza 'Selecciona al menos un personaje.'", () => {
      expect(() => calcularEstimado(CATALOGO, [])).toThrow(
        new SeleccionInvalidaError("Selecciona al menos un personaje.")
      );
    });

    test("todas las cantidades en 0 cuenta como selección vacía", () => {
      expect(() =>
        calcularEstimado(CATALOGO, [
          { servicioId: "batucada", cantidad: 0 },
          { servicioId: "zanquero", cantidad: 0 },
        ])
      ).toThrow("Selecciona al menos un personaje.");
    });
  });

  test("un solo personaje con cantidad 1", () => {
    expect(calcularEstimado(CATALOGO, [{ servicioId: "zanquero", cantidad: 1 }])).toEqual({
      personajes: [
        { servicioId: "zanquero", nombre: "Zanquero Iluminado", cantidad: 1, precioUnitario: 2500, subtotal: 2500 },
      ],
      total: 2500,
    });
  });

  test("un solo personaje con varias unidades: cantidad × precio", () => {
    const { personajes, total } = calcularEstimado(CATALOGO, [{ servicioId: "batucada", cantidad: 3 }]);
    expect(personajes[0]!.subtotal).toBe(11400);
    expect(total).toBe(11400);
  });

  test("varios personajes distintos: suma los subtotales y respeta el orden de la selección", () => {
    const resultado = calcularEstimado(CATALOGO, [
      { servicioId: "cabezones", cantidad: 4 }, // 7 200
      { servicioId: "batucada", cantidad: 2 }, // 7 600
      { servicioId: "zanquero", cantidad: 1 }, // 2 500
    ]);

    expect(resultado.personajes.map((p) => [p.servicioId, p.subtotal])).toEqual([
      ["cabezones", 7200],
      ["batucada", 7600],
      ["zanquero", 2500],
    ]);
    expect(resultado.total).toBe(17300);
  });

  test("las líneas en 0 se descartan sin afectar el total", () => {
    const resultado = calcularEstimado(CATALOGO, [
      { servicioId: "batucada", cantidad: 0 },
      { servicioId: "zanquero", cantidad: 2 },
    ]);
    expect(resultado.personajes.map((p) => p.servicioId)).toEqual(["zanquero"]);
    expect(resultado.total).toBe(5000);
  });

  describe("límite máximo por personaje", () => {
    test(`acepta exactamente ${MAX_CANTIDAD_POR_SERVICIO}`, () => {
      const resultado = calcularEstimado(CATALOGO, [{ servicioId: "batucada", cantidad: MAX_CANTIDAD_POR_SERVICIO }]);
      expect(resultado.personajes[0]!.cantidad).toBe(20);
      expect(resultado.total).toBe(76000);
    });

    test("varios personajes en el máximo a la vez", () => {
      const resultado = calcularEstimado(
        CATALOGO,
        CATALOGO.map((s) => ({ servicioId: s.id, cantidad: MAX_CANTIDAD_POR_SERVICIO }))
      );
      expect(resultado.total).toBe(20 * (3800 + 2500 + 1800));
    });

    test.each([
      ["21 (uno más del máximo)", 21],
      ["negativa", -1],
      ["con decimales", 2.5],
      ["NaN", Number.NaN],
    ])("rechaza una cantidad %s", (_caso, cantidad) => {
      expect(() => calcularEstimado(CATALOGO, [{ servicioId: "batucada", cantidad }])).toThrow(
        "Las cantidades deben ser números enteros entre 0 y 20."
      );
    });

    test("no deja saltarse el máximo repitiendo el mismo personaje", () => {
      expect(() =>
        calcularEstimado(CATALOGO, [
          { servicioId: "batucada", cantidad: 20 },
          { servicioId: "batucada", cantidad: 20 },
        ])
      ).toThrow("Un personaje aparece más de una vez en la cotización.");
    });
  });

  test("un servicio que no está en el catálogo lanza 'ya no está disponible'", () => {
    expect(() => calcularEstimado(CATALOGO, [{ servicioId: "no-existe", cantidad: 1 }])).toThrow(
      new SeleccionInvalidaError("Uno de los personajes seleccionados ya no está disponible.")
    );
  });

  test("un servicio inexistente con cantidad 0 se ignora (no se cotiza)", () => {
    const resultado = calcularEstimado(CATALOGO, [
      { servicioId: "no-existe", cantidad: 0 },
      { servicioId: "zanquero", cantidad: 1 },
    ]);
    expect(resultado.total).toBe(2500);
  });
});

describe("recalcularDetalleCotizador (con MongoDB en memoria)", () => {
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

  test("calcula con los precios y nombres guardados en MongoDB", async () => {
    const detalle = await recalcularDetalleCotizador([
      { servicioId: batucadaId, cantidad: 2 },
      { servicioId: zanqueroId, cantidad: 1 },
    ]);

    expect(detalle).toEqual({
      personajes: [
        { servicioId: batucadaId, nombre: "Batucada 3 Tamboreros", cantidad: 2, precioUnitario: 3800, subtotal: 7600 },
        { servicioId: zanqueroId, nombre: "Zanquero Iluminado", cantidad: 1, precioUnitario: 2500, subtotal: 2500 },
      ],
      total: 10100,
    });
  });

  describe("servicio que ya no existe o está inactivo", () => {
    test("un id que no está en MongoDB lanza SeleccionInvalidaError (no un error de Mongo)", async () => {
      const promesa = recalcularDetalleCotizador([{ servicioId: new Types.ObjectId().toString(), cantidad: 1 }]);
      await expect(promesa).rejects.toBeInstanceOf(SeleccionInvalidaError);
      await expect(promesa).rejects.toThrow("Uno de los personajes seleccionados ya no está disponible.");
    });

    test("un servicio borrado después de que el cliente lo eligió", async () => {
      await Servicio.deleteOne({ _id: zanqueroId });
      await expect(
        recalcularDetalleCotizador([
          { servicioId: batucadaId, cantidad: 1 },
          { servicioId: zanqueroId, cantidad: 1 },
        ])
      ).rejects.toThrow("Uno de los personajes seleccionados ya no está disponible.");
    });

    test("un servicio inactivo (activo: false) no se puede cotizar", async () => {
      await Servicio.updateOne({ _id: zanqueroId }, { activo: false });
      await expect(recalcularDetalleCotizador([{ servicioId: zanqueroId, cantidad: 1 }])).rejects.toBeInstanceOf(
        SeleccionInvalidaError
      );
    });

    test("al reactivarlo vuelve a cotizarse", async () => {
      await Servicio.updateOne({ _id: zanqueroId }, { activo: false });
      await Servicio.updateOne({ _id: zanqueroId }, { activo: true });
      const detalle = await recalcularDetalleCotizador([{ servicioId: zanqueroId, cantidad: 1 }]);
      expect(detalle.total).toBe(2500);
    });
  });

  describe("usa el precio vigente, no uno viejo en caché", () => {
    test("un cambio de precio entre dos cálculos se refleja en el segundo", async () => {
      const seleccion = [{ servicioId: batucadaId, cantidad: 2 }];

      const antes = await recalcularDetalleCotizador(seleccion);
      expect(antes.total).toBe(7600);

      await Servicio.updateOne({ _id: batucadaId }, { precio: 4200 });

      const despues = await recalcularDetalleCotizador(seleccion);
      expect(despues.personajes[0]!.precioUnitario).toBe(4200);
      expect(despues.total).toBe(8400);
    });

    test("también toma el nombre vigente", async () => {
      await Servicio.updateOne({ _id: zanqueroId }, { nombre: "Zanquero LED" });
      const detalle = await recalcularDetalleCotizador([{ servicioId: zanqueroId, cantidad: 1 }]);
      expect(detalle.personajes[0]!.nombre).toBe("Zanquero LED");
    });

    test("un precio que baja también se respeta (no se queda con el mayor visto)", async () => {
      await recalcularDetalleCotizador([{ servicioId: batucadaId, cantidad: 1 }]);
      await Servicio.updateOne({ _id: batucadaId }, { precio: 3000 });
      const detalle = await recalcularDetalleCotizador([{ servicioId: batucadaId, cantidad: 1 }]);
      expect(detalle.total).toBe(3000);
    });
  });

  test("selección vacía también lanza SeleccionInvalidaError contra MongoDB", async () => {
    await expect(recalcularDetalleCotizador([])).rejects.toThrow("Selecciona al menos un personaje.");
  });

  test(`${MAX_CANTIDAD_POR_SERVICIO} unidades con precio de MongoDB`, async () => {
    const detalle = await recalcularDetalleCotizador([{ servicioId: zanqueroId, cantidad: 20 }]);
    expect(detalle.total).toBe(50000);
  });
});
