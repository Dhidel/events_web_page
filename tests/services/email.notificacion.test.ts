import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler } from "../../src/lib/errors";
import { redactPII } from "../../src/lib/privacy";
import { Solicitud } from "../../src/models/Solicitud";
import { cotizacionesRoutes } from "../../src/routes/cotizaciones";
import { crearSolicitud, type CrearSolicitudInput } from "../../src/services/solicitud.service";
import { resendFalso } from "../helpers/resendFalso";

const CLIENTE: CrearSolicitudInput = {
  nombre: "Ana López",
  telefono: "5555-1234",
  correo: "ana.lopez@gmail.com",
  tipoEvento: "Boda",
  origen: "contacto",
};
const API_KEY = process.env.RESEND_API_KEY!; // la key falsa de tests/setup.ts

// El correo se manda en segundo plano: se deja correr la tarea antes de revisar el resultado.
const esperarNotificacion = () => Bun.sleep(20);

let consoleError: ReturnType<typeof spyOn>;
let consoleLog: ReturnType<typeof spyOn>;
const logs = () =>
  [...consoleError.mock.calls, ...consoleLog.mock.calls].map((args) => args.map(String).join(" ")).join("\n");

beforeEach(() => {
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  consoleLog = spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
  consoleLog.mockRestore();
});

describe("crearSolicitud → notificación por correo", () => {
  test("con Resend funcionando: guarda la solicitud y manda el correo", async () => {
    const solicitud = await crearSolicitud(CLIENTE);
    await esperarNotificacion();

    expect(await Solicitud.findById(solicitud.id)).not.toBeNull();
    expect(resendFalso.enviados).toHaveLength(1);
    expect(resendFalso.enviados[0]!.subject).toBe("Nuevo Contacto: Ana López");
    expect(resendFalso.enviados[0]!.html).toContain("ana.lopez@gmail.com");
    expect(consoleError).not.toHaveBeenCalled();
  });

  const fallos = [
    [
      "Resend rechaza la API key (401)",
      { tipo: "error", error: { name: "validation_error", message: "API key is invalid", statusCode: 401 } },
    ],
    [
      "Resend responde con un mensaje que trae correos",
      {
        tipo: "error",
        error: {
          name: "validation_error",
          message: "You can only send testing emails to your own email address (ana.lopez@gmail.com).",
          statusCode: 403,
        },
      },
    ],
    [
      "falla de red con la key y el teléfono en el mensaje",
      { tipo: "lanza", error: new Error(`fetch failed (Authorization: Bearer ${API_KEY}) cliente 5555-1234`) },
    ],
  ] as const;

  for (const [caso, modo] of fallos) {
    describe(caso, () => {
      beforeEach(() => {
        resendFalso.modo = modo as typeof resendFalso.modo;
      });

      test("la solicitud se guarda igual y crearSolicitud no lanza", async () => {
        const solicitud = await crearSolicitud(CLIENTE);
        await esperarNotificacion();

        const guardada = await Solicitud.findById(solicitud.id).lean();
        expect(guardada).not.toBeNull();
        expect(guardada!.correo).toBe("ana.lopez@gmail.com");
        expect(resendFalso.enviados).toHaveLength(0);
      });

      test("el error queda en el log, identificado por el id de la solicitud", async () => {
        const solicitud = await crearSolicitud(CLIENTE);
        await esperarNotificacion();

        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(logs()).toContain(`[Correo] No se pudo enviar la notificación de la solicitud ${solicitud.id}`);
      });

      test("el log no expone la API key ni el correo/teléfono completos", async () => {
        await crearSolicitud(CLIENTE);
        await esperarNotificacion();

        const texto = logs();
        expect(texto).not.toContain(API_KEY);
        expect(texto).not.toContain("ana.lopez@gmail.com");
        expect(texto).not.toContain("5555-1234");
      });
    });
  }

  test("si Resend nunca responde, crearSolicitud no se queda esperando", async () => {
    resendFalso.modo = { tipo: "colgado" };

    const inicio = performance.now();
    const solicitud = await crearSolicitud(CLIENTE);
    expect(performance.now() - inicio).toBeLessThan(1000);
    expect(await Solicitud.findById(solicitud.id)).not.toBeNull();
  });
});

describe("POST /api/cotizaciones con Resend fallando", () => {
  const app = new Elysia().use(errorHandler).use(cotizacionesRoutes);

  test("responde 201 y la solicitud queda en MongoDB", async () => {
    resendFalso.modo = {
      tipo: "error",
      error: { name: "validation_error", message: "API key is invalid", statusCode: 401 },
    };

    const res = await app.handle(
      new Request("http://localhost/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...CLIENTE, fechaEvento: "2026-12-05" }),
      })
    );
    await esperarNotificacion();

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(await Solicitud.findById(body.id)).not.toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe("redactPII enmascara credenciales", () => {
  test.each([
    ["API key de Resend", "key re_AbC123xyz_9876543210qwerty inválida", "key re_**** inválida"],
    ["header Bearer", "Authorization: Bearer abc.def-123", "Authorization: Bearer ****"],
  ])("%s", (_caso, entrada, esperado) => {
    expect(redactPII(entrada)).toBe(esperado);
  });

  test("no toca texto que solo empieza con 're_' corto (no es una key)", () => {
    expect(redactPII("campo re_id")).toBe("campo re_id");
  });
});
