import { describe, expect, mock, test } from "bun:test";
import { DemasiadasSolicitudesError } from "../../client/src/lib/api";
import {
  enlaceWhatsApp,
  guardarYAbrirWhatsApp,
  leerEstimadoGuardado,
  mensajeEstimado,
  redondearMonto,
} from "../../client/src/lib/whatsapp";

// Flujo de Confirmar del Cotizador (client/src/lib/whatsapp.ts) con una pestaña falsa:
// se revisa a dónde navega y si se cierra, sin necesitar un navegador.

const WA = "https://wa.me/50230738716?text=hola";

function pestanaFalsa() {
  return { closed: false, close: mock(() => {}), location: { href: "about:blank" } };
}

describe("guardarYAbrirWhatsApp", () => {
  test("abre la pestaña de forma síncrona, antes de que responda el servidor", () => {
    const abrirPestana = mock(() => pestanaFalsa() as unknown as Window);
    // El guardado nunca termina: la pestaña igual tiene que haberse abierto ya.
    void guardarYAbrirWhatsApp({ waHref: WA, guardar: () => new Promise(() => {}), abrirPestana });
    expect(abrirPestana).toHaveBeenCalledTimes(1);
  });

  test("guardado exitoso: manda la pestaña a WhatsApp", async () => {
    const pestana = pestanaFalsa();
    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => ({ id: "1" }),
      abrirPestana: () => pestana as unknown as Window,
    });

    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: true });
    expect(pestana.location.href).toBe(WA);
    expect(pestana.close).not.toHaveBeenCalled();
  });

  test("guardado fallido: cierra la pestaña y NO abre WhatsApp", async () => {
    const pestana = pestanaFalsa();
    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => {
        throw new Error("Ocurrió un error, intenta de nuevo.");
      },
      abrirPestana: () => pestana as unknown as Window,
    });

    expect(resultado).toEqual({ ok: false, error: "Ocurrió un error, intenta de nuevo." });
    expect(pestana.close).toHaveBeenCalledTimes(1);
    expect(pestana.location.href).toBe("about:blank");
  });

  test("429 (demasiadas solicitudes): cierra la pestaña, no abre WhatsApp y marca limite", async () => {
    const pestana = pestanaFalsa();
    const mensaje = "Recibimos varias solicitudes seguidas desde tu conexión. Espera unos minutos e intenta de nuevo.";
    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => {
        throw new DemasiadasSolicitudesError(mensaje);
      },
      abrirPestana: () => pestana as unknown as Window,
    });

    expect(resultado).toEqual({ ok: false, error: mensaje, limite: true });
    expect(pestana.close).toHaveBeenCalledTimes(1);
    expect(pestana.location.href).toBe("about:blank");
  });

  test("sin conexión al servidor (fetch lanza TypeError): mensaje claro", async () => {
    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => {
        throw new TypeError("Failed to fetch");
      },
      abrirPestana: () => pestanaFalsa() as unknown as Window,
    });
    expect(resultado).toEqual({ ok: false, error: "No pudimos conectar con el servidor." });
  });

  test("el servidor no responde a tiempo: mensaje de timeout", async () => {
    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => {
        throw new DOMException("timeout", "TimeoutError");
      },
      abrirPestana: () => pestanaFalsa() as unknown as Window,
    });
    expect(resultado).toEqual({ ok: false, error: "El servidor tardó demasiado en responder." });
  });

  test("si el navegador bloqueó la pestaña, se guarda igual y avisa que no se abrió", async () => {
    const guardar = mock(async () => ({ id: "1" }));
    const resultado = await guardarYAbrirWhatsApp({ waHref: WA, guardar, abrirPestana: () => null });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: false });
  });

  test("si el usuario cerró la pestaña mientras se guardaba, no intenta navegarla", async () => {
    const pestana = pestanaFalsa();
    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => {
        pestana.closed = true;
      },
      abrirPestana: () => pestana as unknown as Window,
    });
    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: false });
    expect(pestana.location.href).toBe("about:blank");
  });

  test("navega ANTES de cortar el opener (cortarlo antes hace que Chrome rechace la navegación)", async () => {
    const orden: string[] = [];
    const pestana = {
      closed: false,
      close: mock(() => {}),
      location: {
        set href(url: string) {
          orden.push(`navegar a ${url}`);
        },
      },
      set opener(valor: unknown) {
        orden.push(`opener = ${valor}`);
      },
    };

    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => {
        // Mientras se guarda (entre abrir la pestaña y navegarla) nadie tocó el opener.
        expect(orden).toEqual([]);
      },
      abrirPestana: () => pestana as unknown as Window,
    });

    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: true });
    expect(orden).toEqual([`navegar a ${WA}`, "opener = null"]);
  });

  test("si el navegador rechaza la navegación (SecurityError): cierra la pestaña y no lanza", async () => {
    const pestana = {
      closed: false,
      close: mock(() => {}),
      location: {
        set href(_url: string) {
          throw new DOMException("does not have permission to navigate the target frame", "SecurityError");
        },
      },
    };

    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => ({ id: "1" }),
      abrirPestana: () => pestana as unknown as Window,
    });

    // Se guardó; la página muestra el botón "Abrir WhatsApp" en vez de dejar la pestaña en blanco.
    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: false });
    expect(pestana.close).toHaveBeenCalledTimes(1);
  });

  test("si no se puede cortar el opener (pestaña de otro origen), igual cuenta como abierto", async () => {
    let navegada = "";
    const pestana = {
      closed: false,
      close: mock(() => {}),
      location: {
        set href(url: string) {
          navegada = url;
        },
      },
      set opener(_valor: unknown) {
        throw new DOMException("Blocked a frame from accessing a cross-origin frame", "SecurityError");
      },
    };

    const resultado = await guardarYAbrirWhatsApp({
      waHref: WA,
      guardar: async () => ({ id: "1" }),
      abrirPestana: () => pestana as unknown as Window,
    });

    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: true });
    expect(navegada).toBe(WA);
    expect(pestana.close).not.toHaveBeenCalled();
  });

  test("reintentar después de un fallo: el segundo intento abre WhatsApp", async () => {
    let intentos = 0;
    const guardar = async () => {
      intentos += 1;
      if (intentos === 1) throw new TypeError("Failed to fetch");
    };

    const primera = pestanaFalsa();
    const r1 = await guardarYAbrirWhatsApp({ waHref: WA, guardar, abrirPestana: () => primera as unknown as Window });
    expect(r1.ok).toBe(false);
    expect(primera.close).toHaveBeenCalled();

    const segunda = pestanaFalsa();
    const r2 = await guardarYAbrirWhatsApp({ waHref: WA, guardar, abrirPestana: () => segunda as unknown as Window });
    expect(r2).toMatchObject({ ok: true, whatsappAbierto: true });
    expect(segunda.location.href).toBe(WA);
  });
});

describe("WhatsApp con el estimado que guardó el servidor", () => {
  // El cliente armó su estimado con Q3,800 c/u, pero el precio subió a Q4,500 antes de confirmar.
  const guardada = {
    id: "1",
    detalleCotizador: {
      personajes: [{ servicioId: "a", nombre: "Batucada", cantidad: 2, precioUnitario: 4500, subtotal: 9000 }],
      total: 9000,
    },
  };

  test("si waHref es una función, la pestaña navega al enlace armado con lo guardado", async () => {
    const pestana = pestanaFalsa();
    const resultado = await guardarYAbrirWhatsApp({
      waHref: (g: typeof guardada) => {
        const estimado = leerEstimadoGuardado(g.detalleCotizador)!;
        return enlaceWhatsApp(mensajeEstimado(estimado.lineas, estimado.total));
      },
      guardar: async () => guardada,
      abrirPestana: () => pestana as unknown as Window,
    });

    expect(resultado).toMatchObject({ ok: true, whatsappAbierto: true, guardado: guardada });
    const mensaje = decodeURIComponent(pestana.location.href.split("?text=")[1]!);
    expect(mensaje).toContain("2x Batucada (Q9,000)");
    expect(mensaje).toContain("Total estimado: Q9,000");
    expect(mensaje).not.toContain("7,600");
  });

  test("leerEstimadoGuardado devuelve null si el detalle no tiene la forma esperada", () => {
    expect(leerEstimadoGuardado(undefined)).toBeNull();
    expect(leerEstimadoGuardado({ personajes: [], total: "9000" })).toBeNull();
    expect(leerEstimadoGuardado({ personajes: [{ nombre: "X" }], total: 1 })).toBeNull();
  });

  test("el mensaje dice 'Usé' y lista cada línea con su subtotal", () => {
    expect(mensajeEstimado([{ nombre: "Zanquero", cantidad: 3, subtotal: 7500 }], 7500)).toBe(
      "Hola! Usé el cotizador del sitio y me interesa este estimado:\n3x Zanquero (Q7,500)\nTotal estimado: Q7,500"
    );
  });

  test("redondearMonto deja los montos en centavos", () => {
    expect(redondearMonto(0.1 * 3)).toBe(0.3);
    expect(redondearMonto(1999.99 * 3 + 0.1 * 7)).toBe(6000.67);
    expect(redondearMonto(7600)).toBe(7600);
  });
});
