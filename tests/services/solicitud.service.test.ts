import { describe, expect, test } from "bun:test";
import { Types } from "mongoose";
import { Solicitud } from "../../src/models/Solicitud";
import {
  actualizarEstadoSolicitud,
  crearSolicitud,
  listarSolicitudes,
  type CrearSolicitudInput,
} from "../../src/services/solicitud.service";

function datosSolicitud(overrides: Partial<CrearSolicitudInput> = {}): CrearSolicitudInput {
  return {
    nombre: "Ana López",
    telefono: "5555-1234",
    correo: "ana@example.com",
    tipoEvento: "Boda",
    mensaje: "Quiero cotizar batucada",
    origen: "contacto",
    ...overrides,
  };
}

describe("crearSolicitud", () => {
  test("guarda la solicitud en la base con estado 'nuevo'", async () => {
    const creada = await crearSolicitud(datosSolicitud());

    const guardada = await Solicitud.findById(creada.id).lean();
    expect(guardada).not.toBeNull();
    expect(guardada!.nombre).toBe("Ana López");
    expect(guardada!.telefono).toBe("5555-1234");
    expect(guardada!.correo).toBe("ana@example.com");
    expect(guardada!.tipoEvento).toBe("Boda");
    expect(guardada!.mensaje).toBe("Quiero cotizar batucada");
    expect(guardada!.origen).toBe("contacto");
    expect(guardada!.estado).toBe("nuevo");
    expect(guardada!.createdAt).toBeInstanceOf(Date);
  });

  test("pasa el correo a minúsculas", async () => {
    const creada = await crearSolicitud(datosSolicitud({ correo: "Ana@Example.COM" }));
    expect(creada.correo).toBe("ana@example.com");
  });

  test("elimina scripts y etiquetas HTML de los campos de texto", async () => {
    const creada = await crearSolicitud(
      datosSolicitud({
        nombre: "<b>Ana</b>",
        mensaje: "Hola<script>alert('x')</script> mundo",
      })
    );

    const guardada = await Solicitud.findById(creada.id).lean();
    expect(guardada!.nombre).toBe("Ana");
    expect(guardada!.mensaje).toBe("Hola mundo");
  });

  test("sanitiza también el detalle del cotizador (objetos anidados)", async () => {
    const creada = await crearSolicitud(
      datosSolicitud({
        origen: "cotizador",
        detalleCotizador: {
          personajes: [{ nombre: "<i>Zanquero</i>", cantidad: 2 }],
          nota: "<script>x()</script>ok",
          estimado: 1500,
        },
      })
    );

    const guardada = await Solicitud.findById(creada.id).lean();
    expect(guardada!.detalleCotizador).toEqual({
      personajes: [{ nombre: "Zanquero", cantidad: 2 }],
      nota: "ok",
      estimado: 1500,
    });
  });

  test("ignora un estado enviado por el cliente: siempre crea en 'nuevo'", async () => {
    const creada = await crearSolicitud({ ...datosSolicitud(), estado: "confirmado" } as CrearSolicitudInput);
    expect(creada.estado).toBe("nuevo");
  });

  test("rechaza un origen que no existe", async () => {
    await expect(
      crearSolicitud(datosSolicitud({ origen: "whatsapp" as CrearSolicitudInput["origen"] }))
    ).rejects.toThrow();
    expect(await Solicitud.countDocuments()).toBe(0);
  });
});

describe("listarSolicitudes", () => {
  test("devuelve una lista vacía si no hay solicitudes", async () => {
    expect(await listarSolicitudes()).toEqual([]);
  });

  test("devuelve todas las solicitudes, de la más reciente a la más antigua", async () => {
    await crearSolicitud(datosSolicitud({ nombre: "Primera" }));
    await Bun.sleep(5);
    await crearSolicitud(datosSolicitud({ nombre: "Segunda" }));
    await Bun.sleep(5);
    await crearSolicitud(datosSolicitud({ nombre: "Tercera" }));

    const lista = await listarSolicitudes();
    expect(lista.map((s) => s.nombre)).toEqual(["Tercera", "Segunda", "Primera"]);
  });

  test("filtra por estado cuando se indica", async () => {
    const a = await crearSolicitud(datosSolicitud({ nombre: "A" }));
    await crearSolicitud(datosSolicitud({ nombre: "B" }));
    await actualizarEstadoSolicitud(a.id, "contactado");

    const contactadas = await listarSolicitudes("contactado");
    expect(contactadas.map((s) => s.nombre)).toEqual(["A"]);

    const nuevas = await listarSolicitudes("nuevo");
    expect(nuevas.map((s) => s.nombre)).toEqual(["B"]);

    expect(await listarSolicitudes("confirmado")).toEqual([]);
  });
});

describe("actualizarEstadoSolicitud", () => {
  test("cambia el estado y lo persiste en la base", async () => {
    const creada = await crearSolicitud(datosSolicitud());

    const actualizada = await actualizarEstadoSolicitud(creada.id, "propuesta_enviada");
    expect(actualizada).not.toBeNull();
    expect(actualizada!.estado).toBe("propuesta_enviada");

    const guardada = await Solicitud.findById(creada.id).lean();
    expect(guardada!.estado).toBe("propuesta_enviada");
    // No toca los demás campos.
    expect(guardada!.nombre).toBe("Ana López");
  });

  test("devuelve null si el id no existe", async () => {
    const idInexistente = new Types.ObjectId().toString();
    expect(await actualizarEstadoSolicitud(idInexistente, "contactado")).toBeNull();
  });

  test("lanza error si el id no tiene formato de ObjectId", async () => {
    // La ruta valida el id antes de llamar al servicio; aquí se documenta que el
    // servicio por sí solo no lo convierte en null.
    await expect(actualizarEstadoSolicitud("no-es-un-id", "contactado")).rejects.toThrow();
  });

  test("rechaza un estado que no existe y no modifica el documento", async () => {
    const creada = await crearSolicitud(datosSolicitud());

    await expect(
      actualizarEstadoSolicitud(creada.id, "cancelado" as Parameters<typeof actualizarEstadoSolicitud>[1])
    ).rejects.toThrow();

    const guardada = await Solicitud.findById(creada.id).lean();
    expect(guardada!.estado).toBe("nuevo");
  });
});
