import { describe, expect, test } from "bun:test";
import { indiceCircular, pasoPorDeslizamiento, siguienteFocoAtrapado, UMBRAL_DESLIZAR } from "../../client/src/lib/lightbox";

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
