// Lógica pura del lightbox de la galería ([12.2]): sin DOM ni React, para poder probarla con bun test.

// Índice de la foto siguiente/anterior, dando la vuelta en los extremos (de la última a la primera).
export function indiceCircular(actual: number, paso: number, total: number): number {
  if (total <= 0) return 0;
  return (((actual + paso) % total) + total) % total;
}

// Distancia horizontal mínima (px) para que un toque cuente como deslizamiento y no como tap.
export const UMBRAL_DESLIZAR = 50;

// Convierte un gesto táctil en un cambio de foto: deslizar a la izquierda = siguiente (+1),
// a la derecha = anterior (-1). Devuelve 0 si fue corto o más vertical que horizontal (por
// ejemplo, un intento de scroll), para no cambiar de foto sin querer.
export function pasoPorDeslizamiento(dx: number, dy: number, umbral = UMBRAL_DESLIZAR): -1 | 0 | 1 {
  if (Math.abs(dx) < umbral || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

// Foco atrapado: a qué elemento enfocable pasa el Tab (o Shift+Tab) dentro del diálogo.
// `actual` es -1 si el foco no está en ninguno de ellos. Devuelve -1 si no hay enfocables.
export function siguienteFocoAtrapado(actual: number, total: number, haciaAtras: boolean): number {
  if (total <= 0) return -1;
  if (actual < 0) return haciaAtras ? total - 1 : 0;
  return indiceCircular(actual, haciaAtras ? -1 : 1, total);
}
