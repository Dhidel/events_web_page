import { afterEach, beforeEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler } from "../../src/lib/errors";
import { FACTOR_IP_DESCONOCIDA, limiteCotizaciones, limiteLogin } from "../../src/lib/limiteSolicitudes";
import { seguridadHttp } from "../../src/lib/seguridadHttp";
import { AdminUser } from "../../src/models/AdminUser";
import { Solicitud } from "../../src/models/Solicitud";
import { authRoutes } from "../../src/routes/auth";
import { cotizacionesRoutes } from "../../src/routes/cotizaciones";
import { cloudinaryFalso } from "../helpers/cloudinaryFalso";
import { resendFalso } from "../helpers/resendFalso";

// [14.3] Lo agregado sobre el anti-spam del compañero: Retry-After, IP no falsificable,
// IPv6 por /64, IP desconocida, honeypot y límite del login. tests/setup.ts usa
// TRUST_PROXY_HOPS=1 (la IP sale de X-Forwarded-For) y reinicia los límites entre pruebas.

const SITIO = "https://www.midominio.com";
// Como en producción: con CORS y HSTS, para comprobar que el 429 también los lleva.
const app = new Elysia()
  .use(errorHandler)
  .use(seguridadHttp({ produccion: true, corsOrigin: SITIO, log: { warn: () => {}, log: () => {} } }))
  .use(cotizacionesRoutes)
  .use(authRoutes);

const MAX = limiteCotizaciones.max; // 5 por defecto (valor del compañero)
const VENTANA_SEG = limiteCotizaciones.ventanaMinutos * 60; // 10 min
const MENSAJE_429 = "Recibimos varias solicitudes seguidas desde tu conexión. Espera unos minutos e intenta de nuevo.";
const IP_A = "190.56.12.3";
const IP_B = "190.56.99.200";

const contacto = { nombre: "Ana López", telefono: "5555-1234", correo: "ana@example.com", origen: "contacto" };
// Mensaje distinto en cada envío: si no, la detección de duplicados del compañero los
// trataría como reenvíos (no se guardan de nuevo) y no se podría contar lo guardado.
let n = 0;
const nueva = (extra: Record<string, unknown> = {}) => ({ ...contacto, mensaje: `Consulta ${++n}`, ...extra });

function enviar(body: Record<string, unknown>, ip?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: SITIO };
  if (ip) headers["X-Forwarded-For"] = ip;
  return app.handle(new Request("http://localhost/api/cotizaciones", { method: "POST", headers, body: JSON.stringify(body) }));
}

function login(body: Record<string, unknown>, ip: string) {
  return app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify(body),
    })
  );
}

// Reloj controlado para "pasar el tiempo" sin esperar.
let ahora = new Date("2026-10-11T12:00:00Z").getTime();
const avanzarMin = (min: number) => setSystemTime(new Date((ahora += min * 60_000)));

let consoleWarn: ReturnType<typeof spyOn>;
beforeEach(() => {
  setSystemTime(new Date(ahora));
  consoleWarn = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  setSystemTime();
  consoleWarn.mockRestore();
});

const avisos = () => consoleWarn.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");

async function agotarCuota(ip: string) {
  for (let i = 0; i < MAX; i++) expect((await enviar(nueva(), ip)).status).toBe(201);
}

// ---------------------------------------------------------------------------------------

describe("límite por IP en POST /api/cotizaciones", () => {
  test(`el envío ${MAX + 1} desde la misma IP → 429 con { error } y Retry-After`, async () => {
    await agotarCuota(IP_A);

    const res = await enviar(nueva(), IP_A);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: MENSAJE_429 });
    expect(res.headers.get("retry-after")).toBe(String(VENTANA_SEG));
    expect(await Solicitud.countDocuments()).toBe(MAX);
  });

  test("el 429 lleva los headers de CORS y HSTS del [14.2]", async () => {
    await agotarCuota(IP_A);
    const res = await enviar(nueva(), IP_A);
    expect(res.status).toBe(429);
    expect(res.headers.get("access-control-allow-origin")).toBe(SITIO);
    expect(res.headers.get("strict-transport-security")).toBe("max-age=15552000");
  });

  test("pasado el periodo vuelve a aceptar, y Retry-After baja con el tiempo", async () => {
    await agotarCuota(IP_A);
    avanzarMin(4);
    const aun = await enviar(nueva(), IP_A);
    expect(aun.status).toBe(429);
    expect(aun.headers.get("retry-after")).toBe(String(VENTANA_SEG - 4 * 60));

    avanzarMin(limiteCotizaciones.ventanaMinutos - 4);
    expect((await enviar(nueva(), IP_A)).status).toBe(201);
  });

  test("IPs distintas no se afectan entre sí", async () => {
    await agotarCuota(IP_A);
    expect((await enviar(nueva(), IP_A)).status).toBe(429);
    expect((await enviar(nueva(), IP_B)).status).toBe(201);
  });

  test("no se puede esquivar escribiendo otra IP en X-Forwarded-For", async () => {
    await agotarCuota(IP_A);
    // El atacante agrega IPs falsas a la izquierda; el proxy agrega la real al final.
    for (const falsa of ["1.2.3.4", "5.6.7.8", "9.9.9.9"]) {
      expect((await enviar(nueva(), `${falsa}, ${IP_A}`)).status).toBe(429);
    }
  });

  test("IPv6: todo el /64 comparte el límite", async () => {
    for (let i = 1; i <= MAX; i++) expect((await enviar(nueva(), `2001:db8:aaaa:1::${i}`)).status).toBe(201);
    expect((await enviar(nueva(), "2001:db8:aaaa:1::ffff")).status).toBe(429);
    expect((await enviar(nueva(), "2001:db8:aaaa:2::1")).status).toBe(201);
  });

  test("como definió el compañero, los envíos rechazados por validación (422) no cuentan", async () => {
    for (let i = 0; i < MAX + 3; i++) expect((await enviar({ ...contacto, correo: "malo" }, IP_A)).status).toBe(422);
    expect((await enviar(nueva(), IP_A)).status).toBe(201);
  });

  test("IP desconocida: cuota aparte y más permisiva, con un solo aviso y sin IPs en el log", async () => {
    // Sin X-Forwarded-For ni conexión real (app.handle) no se puede saber la IP.
    for (let i = 0; i < MAX + 3; i++) expect((await enviar(nueva())).status).toBe(201);
    // No comparte cupo con las IPs conocidas.
    expect((await enviar(nueva(), IP_A)).status).toBe(201);

    const aviso = avisos().split("\n").filter((l: string) => l.includes("No se pudo determinar la IP"));
    expect(aviso).toHaveLength(1);
    expect(aviso[0]).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  test(`la cuota de IP desconocida también tiene tope (${MAX * FACTOR_IP_DESCONOCIDA})`, async () => {
    for (let i = 0; i < MAX * FACTOR_IP_DESCONOCIDA; i++) expect((await enviar(nueva())).status).toBe(201);
    expect((await enviar(nueva())).status).toBe(429);
  });
});

// ---------------------------------------------------------------------------------------

describe("honeypot sitioWeb", () => {
  test("lleno → 201 que parece normal, pero no se guarda nada ni se manda correo", async () => {
    const res = await enviar(nueva({ sitioWeb: "http://spam.example" }), IP_A);
    await Bun.sleep(20); // el correo se manda en segundo plano: darle tiempo a que (no) ocurra

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toMatch(/^[a-f0-9]{24}$/);
    expect(body._id).toBe(body.id);
    expect(body).toMatchObject({ nombre: "Ana López", correo: "ana@example.com", origen: "contacto", estado: "nuevo" });
    expect(body).not.toHaveProperty("sitioWeb");

    expect(await Solicitud.countDocuments()).toBe(0);
    expect(resendFalso.enviados).toHaveLength(0);
    expect(cloudinaryFalso.subidas).toHaveLength(0);
  });

  test("lleno desde el Cotizador: no consulta la base (ni siquiera los servicios)", async () => {
    const res = await enviar(
      nueva({
        origen: "cotizador",
        // Un servicio que no existe: si se consultara la base, respondería 422.
        detalleCotizador: { personajes: [{ servicioId: "6ab4600a9f8e7d6c5b4a3921", cantidad: 1 }], total: 1 },
        sitioWeb: "x",
      }),
      IP_A
    );
    expect(res.status).toBe(201);
    expect(await Solicitud.countDocuments()).toBe(0);
  });

  test("el log dice que se descartó, sin datos personales", async () => {
    await enviar(nueva({ sitioWeb: "http://spam.example" }), IP_A);
    expect(avisos()).toContain("[Anti-spam] Envío descartado por honeypot (origen: contacto).");
    for (const dato of ["Ana", "ana@example.com", "5555-1234", "spam.example", IP_A]) expect(avisos()).not.toContain(dato);
  });

  test("vacío, omitido o solo espacios → comportamiento normal (se guarda y se notifica)", async () => {
    expect((await enviar(nueva({ sitioWeb: "" }), IP_A)).status).toBe(201);
    expect((await enviar(nueva(), IP_A)).status).toBe(201);
    expect((await enviar(nueva({ sitioWeb: "   " }), IP_A)).status).toBe(201);
    await Bun.sleep(20);
    expect(await Solicitud.countDocuments()).toBe(3);
    expect(resendFalso.enviados).toHaveLength(3);
  });

  test("el honeypot está declarado: no provoca 422 por campo extra", async () => {
    const res = await enviar(nueva({ sitioWeb: "algo" }), IP_A);
    expect(res.status).toBe(201);
  });

  test("se revisa después del límite: un bot insistente termina en 429", async () => {
    for (let i = 0; i < MAX; i++) expect((await enviar(nueva({ sitioWeb: "x" }), IP_A)).status).toBe(201);
    expect((await enviar(nueva({ sitioWeb: "x" }), IP_A)).status).toBe(429);
  });

  test("más de 200 caracteres → 422 como cualquier campo largo", async () => {
    expect((await enviar(nueva({ sitioWeb: "x".repeat(201) }), IP_A)).status).toBe(422);
  });
});

// ---------------------------------------------------------------------------------------

describe("límite de intentos fallidos en POST /api/auth/login", () => {
  const CORRECTO = { email: "admin@example.com", password: "clave-correcta-123" };
  const MAL = { email: "admin@example.com", password: "otra-cosa" };
  beforeEach(async () => {
    await AdminUser.create({ ...CORRECTO, name: "Admin" });
  });

  test(`tras ${limiteLogin.max} fallos → 429 con Retry-After, aunque la contraseña sea correcta`, async () => {
    for (let i = 0; i < limiteLogin.max; i++) expect((await login(MAL, IP_A)).status).toBe(401);

    const res = await login(CORRECTO, IP_A);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo." });
    expect(res.headers.get("retry-after")).toBe(String(limiteLogin.ventanaMinutos * 60));
  });

  test("los correos mal formados también son 401 y cuentan", async () => {
    for (let i = 0; i < limiteLogin.max; i++) expect((await login({ email: "no-es-correo", password: "x" }, IP_A)).status).toBe(401);
    expect((await login(CORRECTO, IP_A)).status).toBe(429);
  });

  test("los inicios de sesión correctos no cuentan", async () => {
    for (let i = 0; i < limiteLogin.max + 5; i++) expect((await login(CORRECTO, IP_A)).status).toBe(200);
  });

  test("los 422 (datos mal formados) no cuentan, solo los 401", async () => {
    for (let i = 0; i < limiteLogin.max + 5; i++) expect((await login({ email: 1, password: 2 }, IP_A)).status).toBe(422);
    expect((await login(CORRECTO, IP_A)).status).toBe(200);
  });

  test("otra IP puede seguir intentando (sin límite por correo)", async () => {
    for (let i = 0; i < limiteLogin.max; i++) await login(MAL, IP_A);
    expect((await login(CORRECTO, IP_A)).status).toBe(429);
    expect((await login(CORRECTO, IP_B)).status).toBe(200);
  });

  test("pasado el periodo se puede volver a intentar", async () => {
    for (let i = 0; i < limiteLogin.max; i++) await login(MAL, IP_A);
    expect((await login(CORRECTO, IP_A)).status).toBe(429);
    avanzarMin(limiteLogin.ventanaMinutos);
    expect((await login(CORRECTO, IP_A)).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------------------

// Arranque real de src/index.ts en producción: log de la configuración de IP y aviso cuando
// la IP detectada es la del proxy. Nunca se escribe la IP.
describe("servidor real (src/index.ts) en producción", () => {
  async function arrancar(env: Record<string, string>) {
    const puerto = String(4100 + Math.floor(Math.random() * 800));
    const proceso = Bun.spawn(["bun", "src/index.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        MONGODB_URI: `${process.env.TEST_MONGODB_URI}antispam`,
        PORT: puerto,
        CORS_ORIGIN: SITIO,
        CLIENT_IP_HEADER: "",
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const salida: string[] = [];
    const leer = async (s: ReadableStream<Uint8Array>) => {
      for await (const trozo of s) salida.push(new TextDecoder().decode(trozo));
    };
    void leer(proceso.stdout);
    void leer(proceso.stderr);
    for (let i = 0; i < 100 && !salida.join("").includes("Servidor ejecutándose"); i++) await Bun.sleep(100);

    // Un 422 no llega al limitador (Elysia valida antes del handler), así que se manda un
    // envío con honeypot: pasa por el cálculo de la IP y responde 201 sin guardar nada.
    const enviarDesde = (xff: string) =>
      fetch(`http://localhost:${puerto}/api/cotizaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": xff },
        body: JSON.stringify({ ...contacto, sitioWeb: "x" }),
      });
    return { proceso, salida, enviarDesde };
  }

  test("sin CLIENT_IP_HEADER ni TRUST_PROXY_HOPS: advierte al arrancar", async () => {
    const { proceso, salida } = await arrancar({ TRUST_PROXY_HOPS: "0" });
    try {
      const log = salida.join("");
      expect(log).toContain("⚠ [Anti-spam] REVISA LA CONFIGURACIÓN DE IP");
      expect(log).toContain("TODOS los visitantes compartirán el límite");
      expect(log).toContain("Límites por IP: cotizaciones 5 cada 10 min; login 10 intentos fallidos cada 15 min.");
    } finally {
      proceso.kill();
    }
  }, 30_000);

  test("con TRUST_PROXY_HOPS=1: lo muestra y avisa si la primera IP es interna (la del proxy)", async () => {
    const { proceso, salida, enviarDesde } = await arrancar({ TRUST_PROXY_HOPS: "1" });
    try {
      expect(salida.join("")).toContain("[Anti-spam] IP del cliente: TRUST_PROXY_HOPS=1");
      await enviarDesde("10.0.0.5");
      await Bun.sleep(200);
      const log = salida.join("");
      expect(log).toContain("CONFIGURACIÓN DE IP INCORRECTA");
      expect(log).not.toContain("10.0.0.5");
    } finally {
      proceso.kill();
    }
  }, 30_000);

  test("con TRUST_PROXY_HOPS=1 y una IP pública: confirma que la configuración es correcta", async () => {
    const { proceso, salida, enviarDesde } = await arrancar({ TRUST_PROXY_HOPS: "1" });
    try {
      await enviarDesde("190.56.12.3");
      await Bun.sleep(200);
      const log = salida.join("");
      expect(log).toContain("Primera IP de cliente detectada: es pública (configuración correcta)");
      expect(log).not.toContain("190.56.12.3");
    } finally {
      proceso.kill();
    }
  }, 30_000);
});
