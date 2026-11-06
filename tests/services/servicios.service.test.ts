import { describe, expect, test } from "bun:test";
import { Servicio, type ServicioAttrs } from "../../src/models/Servicio";
import { listarServiciosActivos } from "../../src/services/servicios.service";

// El servicio solo expone lectura: los datos de prueba se insertan con el modelo.
function crearServicio(overrides: Partial<ServicioAttrs> = {}) {
  return Servicio.create({
    nombre: "Batucada clásica",
    descripcion: "Grupo de percusión",
    categoria: "Batucadas",
    precio: 1200,
    unidad: "por hora",
    ...overrides,
  });
}

describe("listarServiciosActivos", () => {
  test("devuelve una lista vacía si no hay servicios", async () => {
    expect(await listarServiciosActivos()).toEqual([]);
  });

  test("devuelve solo los servicios activos, ordenados por 'orden'", async () => {
    await crearServicio({ nombre: "Tercero", orden: 3 });
    await crearServicio({ nombre: "Oculto", orden: 0, activo: false });
    await crearServicio({ nombre: "Primero", orden: 1 });
    await crearServicio({ nombre: "Segundo", orden: 2 });

    const lista = await listarServiciosActivos();
    expect(lista.map((s) => s.nombre)).toEqual(["Primero", "Segundo", "Tercero"]);
  });

  test("filtra por categoría cuando se indica", async () => {
    await crearServicio({ nombre: "Batucada", categoria: "Batucadas" });
    await crearServicio({ nombre: "Zanquero", categoria: "Zanqueros" });
    await crearServicio({ nombre: "Zanquero oculto", categoria: "Zanqueros", activo: false });

    const zanqueros = await listarServiciosActivos("Zanqueros");
    expect(zanqueros.map((s) => s.nombre)).toEqual(["Zanquero"]);
  });

  test("devuelve lista vacía para una categoría sin servicios", async () => {
    await crearServicio();
    expect(await listarServiciosActivos("Personajes")).toEqual([]);
  });
});
