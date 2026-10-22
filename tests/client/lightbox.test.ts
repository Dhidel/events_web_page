import { describe, expect, mock, test } from "bun:test";
import {
  entradaHistorialLightbox,
  indiceCircular,
  pasoPorDeslizamiento,
  siguienteFocoAtrapado,
  UMBRAL_DESLIZAR,
} from "../../client/src/lib/lightbox";

// Lógica del lightbox de la galería (client/src/lib/lightbox.ts). El comportamiento en el
// navegador (teclado, foco, scroll) se verifica aparte en Chrome.

describe("indiceCircular", () => {
  test("avanza y retrocede dentro del rango", () => {
    expect(indiceCircular(2, 1, 7)).toBe(3);
    expect(indiceCircular(2, -1, 7)).toBe(1);
  });

  test("da la vuelta en los extremos", () => {
    expect(indiceCircular(6, 1, 7)).toBe(0);
    expect(indiceCircular(0, -1, 7)).toBe(6);
  });

  test("con una sola foto se queda en ella; sin fotos devuelve 0", () => {
    expect(indiceCircular(0, 1, 1)).toBe(0);
    expect(indiceCircular(0, -1, 0)).toBe(0);
  });
});

describe("pasoPorDeslizamiento", () => {
  test("deslizar a la izquierda = siguiente; a la derecha = anterior", () => {
    expect(pasoPorDeslizamiento(-80, 5)).toBe(1);
    expect(pasoPorDeslizamiento(80, -5)).toBe(-1);
  });

  test("un movimiento corto cuenta como tap, no como deslizamiento", () => {
    expect(pasoPorDeslizamiento(-(UMBRAL_DESLIZAR - 1), 0)).toBe(0);
    expect(pasoPorDeslizamiento(-UMBRAL_DESLIZAR, 0)).toBe(1);
  });

  test("un gesto más vertical que horizontal (intento de scroll) no cambia de foto", () => {
    expect(pasoPorDeslizamiento(-60, 50)).toBe(0);
    expect(pasoPorDeslizamiento(-60, -200)).toBe(0);
  });
});

describe("siguienteFocoAtrapado", () => {
  test("Tab avanza y desde el último vuelve al primero", () => {
    expect(siguienteFocoAtrapado(0, 3, false)).toBe(1);
    expect(siguienteFocoAtrapado(2, 3, false)).toBe(0);
  });

  test("Shift+Tab retrocede y desde el primero va al último", () => {
    expect(siguienteFocoAtrapado(1, 3, true)).toBe(0);
    expect(siguienteFocoAtrapado(0, 3, true)).toBe(2);
  });

  test("si el foco no está en ningún botón, entra por el primero (o el último con Shift)", () => {
    expect(siguienteFocoAtrapado(-1, 3, false)).toBe(0);
    expect(siguienteFocoAtrapado(-1, 3, true)).toBe(2);
  });

  test("sin elementos enfocables devuelve -1", () => {
    expect(siguienteFocoAtrapado(-1, 0, false)).toBe(-1);
  });
});

// Historial falso que se comporta como el del navegador: una pila de states con una posición,
// y back() que retrocede y avisa con "popstate" (asíncrono, como en el navegador).
function historialFalso() {
  const ventana = new EventTarget();
  const pila: unknown[] = [{ idx: 3, key: "galeria" }];
  let pos = 0;
  const historial = {
    get state() {
      return pila[pos];
    },
    pushState: mock((estado: unknown) => {
      pila.splice(pos + 1, Infinity, estado);
      pos++;
    }),
    back: mock(() => {
      if (pos === 0) return;
      pos--;
      setTimeout(() => ventana.dispatchEvent(new Event("popstate")), 0);
    }),
  };
  return { historial, ventana: ventana as unknown as Window, largo: () => pos + 1 };
}

const unInstante = () => Bun.sleep(5);

describe("entradaHistorialLightbox (botón Atrás)", () => {
  test("al abrir agrega una entrada con la misma state de React Router, marcada", () => {
    const { historial, ventana, largo } = historialFalso();
    entradaHistorialLightbox(historial, ventana, () => {});

    expect(largo()).toBe(2);
    expect(historial.state).toEqual({ idx: 3, key: "galeria", lightboxAbierto: true });
  });

  test("Atrás con la foto abierta: cierra la foto y se queda en la página", async () => {
    const { historial, ventana, largo } = historialFalso();
    const alVolver = mock(() => {});
    const limpiar = entradaHistorialLightbox(historial, ventana, alVolver);

    historial.back(); // el usuario pulsa Atrás
    await unInstante();
    expect(alVolver).toHaveBeenCalledTimes(1);
    expect(largo()).toBe(1); // sigue en la entrada de la galería, no salió de la página

    limpiar(); // el padre desmonta el lightbox
    await unInstante();
    expect(historial.back).toHaveBeenCalledTimes(1); // no retrocede otra vez
    expect(largo()).toBe(1);
  });

  test("cerrar con ×, Esc o tocar fuera quita la entrada: el siguiente Atrás sale de la página", async () => {
    const { historial, ventana, largo } = historialFalso();
    const alVolver = mock(() => {});
    const limpiar = entradaHistorialLightbox(historial, ventana, alVolver);

    limpiar();
    await unInstante();
    expect(historial.back).toHaveBeenCalledTimes(1);
    expect(largo()).toBe(1);
    expect(alVolver).not.toHaveBeenCalled();
  });

  test("StrictMode (montar, desmontar y volver a montar): una sola entrada y no se cierra sola", async () => {
    const { historial, ventana, largo } = historialFalso();
    const alVolver = mock(() => {});
    entradaHistorialLightbox(historial, ventana, alVolver)();
    const limpiar = entradaHistorialLightbox(historial, ventana, alVolver);
    await unInstante();

    expect(historial.pushState).toHaveBeenCalledTimes(1);
    expect(historial.back).not.toHaveBeenCalled();
    expect(alVolver).not.toHaveBeenCalled();
    expect(largo()).toBe(2);

    limpiar();
    await unInstante();
    expect(largo()).toBe(1);
  });

  test("abrir, cerrar y volver a abrir otra foto: cada apertura deja una sola entrada", async () => {
    const { historial, ventana, largo } = historialFalso();
    entradaHistorialLightbox(historial, ventana, () => {})();
    await unInstante();
    entradaHistorialLightbox(historial, ventana, () => {});

    expect(largo()).toBe(2);
  });
});
