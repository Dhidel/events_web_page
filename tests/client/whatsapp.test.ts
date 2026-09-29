import { describe, expect, mock, test } from "bun:test";
import { guardarYAbrirWhatsApp } from "../../client/src/lib/whatsapp";

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

    expect(resultado).toEqual({ ok: true, whatsappAbierto: true });
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
    expect(resultado).toEqual({ ok: true, whatsappAbierto: false });
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
    expect(resultado).toEqual({ ok: true, whatsappAbierto: false });
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

    expect(resultado).toEqual({ ok: true, whatsappAbierto: true });
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
    expect(resultado).toEqual({ ok: true, whatsappAbierto: false });
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

    expect(resultado).toEqual({ ok: true, whatsappAbierto: true });
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
    expect(r2).toEqual({ ok: true, whatsappAbierto: true });
    expect(segunda.location.href).toBe(WA);
  });
});
