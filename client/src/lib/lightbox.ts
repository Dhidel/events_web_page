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

// Botón "Atrás" (del navegador o el gesto/botón de Android) con el lightbox abierto: tiene que
// cerrar la foto, no salir de la página. Para eso, al abrir se agrega una entrada al historial
// (misma URL, marcada en el state) y "Atrás" la consume: llega un popstate y se cierra.
// Si se cierra de otra forma (×, Esc, tocar fuera), se quita esa entrada con history.back(),
// para que el siguiente "Atrás" sí lleve a la página anterior.
//
// Recibe history y window como parámetros para poder probarlo con bun test sin navegador.
// Devuelve la función de limpieza (para el return de un useEffect).

const MARCA_HISTORIAL = "lightboxAbierto";

type Historial = Pick<History, "state" | "pushState" | "back">;
type Ventana = Pick<Window, "addEventListener" | "removeEventListener">;

const tieneMarca = (estado: unknown) =>
  typeof estado === "object" && estado !== null && (estado as Record<string, unknown>)[MARCA_HISTORIAL] === true;

// history.back() pendiente de un cierre. Se difiere un instante porque en desarrollo StrictMode
// desmonta y vuelve a montar el componente enseguida: si el back() fuera inmediato, su popstate
// llegaría al lightbox recién montado y lo cerraría. Al volver a montar, se cancela y se reusa
// la entrada que ya estaba.
let atrasPendiente: ReturnType<typeof setTimeout> | null = null;

export function entradaHistorialLightbox(historial: Historial, ventana: Ventana, alVolver: () => void): () => void {
  if (atrasPendiente !== null) {
    clearTimeout(atrasPendiente);
    atrasPendiente = null;
  }
  // Se conserva el state que haya (React Router guarda ahí su índice y su key).
  if (!tieneMarca(historial.state)) historial.pushState({ ...(historial.state ?? {}), [MARCA_HISTORIAL]: true }, "");

  const alPopstate = () => {
    if (!tieneMarca(historial.state)) alVolver();
  };
  ventana.addEventListener("popstate", alPopstate);

  return () => {
    ventana.removeEventListener("popstate", alPopstate);
    // Si la entrada sigue ahí, se cerró sin "Atrás": se quita.
    if (tieneMarca(historial.state)) {
      atrasPendiente = setTimeout(() => {
        atrasPendiente = null;
        historial.back();
      }, 0);
    }
  };
}
