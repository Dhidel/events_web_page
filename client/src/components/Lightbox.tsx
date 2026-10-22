import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { entradaHistorialLightbox, indiceCircular, pasoPorDeslizamiento, siguienteFocoAtrapado } from "../lib/lightbox";

export interface FotoLightbox {
  src: string;
  alt: string;
  label?: string;
  tag?: string;
}

// Visor de fotos a pantalla completa ([12.2]). Se usa en /galeria y en la vista previa del Inicio.
// - Abre desde un <button> (clic, Enter o Espacio); Esc, el botón × o tocar fuera de la foto cierran.
// - Flechas del teclado, botones ‹ › o deslizar con el dedo cambian de foto.
// - Mientras está abierto: el resto de la página queda inert (ni Tab ni lector de pantalla salen
//   del diálogo), el foco da la vuelta entre los botones y el fondo no hace scroll. Al cerrar,
//   el foco vuelve al botón que lo abrió.
// - "Atrás" del navegador o del teléfono cierra la foto en vez de salir de la página.
// - Con prefers-reduced-motion no hay animación de entrada (index.css).
export default function Lightbox({
  fotos,
  indice,
  onCambiar,
  onCerrar,
}: {
  fotos: FotoLightbox[];
  indice: number;
  onCambiar: (indice: number) => void;
  onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDivElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const inicioToque = useRef<{ x: number; y: number } | null>(null);
  const foto = fotos[indice];
  const total = fotos.length;

  // Al abrir: guarda quién tenía el foco, bloquea el scroll del fondo y deja la página inert.
  // Al cerrar (desmontar) deshace todo y devuelve el foco. useLayoutEffect: el fondo se bloquea
  // antes del primer pintado del diálogo.
  useLayoutEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const raiz = document.getElementById("root");
    const body = document.body;
    const estilo = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    // Compensa el ancho de la barra de scroll para que la página no "salte" al ocultarla.
    const barra = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (barra > 0) body.style.paddingRight = `${barra}px`;
    raiz?.setAttribute("inert", "");
    botonCerrar.current?.focus();
    return () => {
      body.style.overflow = estilo.overflow;
      body.style.paddingRight = estilo.paddingRight;
      raiz?.removeAttribute("inert");
      anterior?.focus({ preventScroll: true });
    };
  }, []);

  // "Atrás" cierra la foto (ver entradaHistorialLightbox). Si el efecto se repite (StrictMode o
  // un onCerrar nuevo), se reusa la misma entrada del historial en vez de agregar otra.
  useEffect(() => entradaHistorialLightbox(window.history, window, onCerrar), [onCerrar]);

  // Esc se escucha en el documento: cierra aunque el foco haya quedado fuera de un botón.
  useEffect(() => {
    const alPresionar = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
      }
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  if (!foto) return null;

  const cambiar = (paso: number) => {
    if (total > 1) onCambiar(indiceCircular(indice, paso, total));
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      cambiar(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      cambiar(-1);
    } else if (e.key === "Tab") {
      // Foco atrapado: Tab y Shift+Tab dan la vuelta entre los botones del diálogo.
      const enfocables = [...(dialogo.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
      const siguiente = siguienteFocoAtrapado(enfocables.indexOf(document.activeElement as HTMLElement), enfocables.length, e.shiftKey);
      if (siguiente >= 0) {
        e.preventDefault();
        enfocables[siguiente]!.focus();
      }
    }
  };

  // Tocar fuera de la foto (el fondo oscuro) cierra. La foto, el pie y los botones no.
  const esFondo = (destino: EventTarget) => !(destino as Element).closest(".lightbox-img, .lightbox-pie, .lightbox-btn");
  const alHacerClic = (e: MouseEvent<HTMLDivElement>) => {
    if (esFondo(e.target)) onCerrar();
  };

  const alEmpezarToque = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    inicioToque.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  };
  const alTerminarToque = (e: TouchEvent<HTMLDivElement>) => {
    const inicio = inicioToque.current;
    const t = e.changedTouches[0];
    inicioToque.current = null;
    if (!inicio || !t) return;
    const dx = t.clientX - inicio.x;
    const dy = t.clientY - inicio.y;
    const paso = pasoPorDeslizamiento(dx, dy);
    if (paso !== 0) {
      // Fue un deslizamiento: que no cuente además como "tocar fuera".
      e.preventDefault();
      cambiar(paso);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && esFondo(e.target)) {
      // Toque corto sobre el fondo: se cierra aquí y no en el click, porque después de un
      // deslizamiento el navegador puede no generar el click del toque siguiente.
      e.preventDefault();
      onCerrar();
    }
  };

  return createPortal(
    <div
      ref={dialogo}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de fotos"
      onKeyDown={alTeclear}
      onClick={alHacerClic}
      onTouchStart={alEmpezarToque}
      onTouchEnd={alTerminarToque}
    >
      <button ref={botonCerrar} type="button" className="lightbox-btn lightbox-cerrar" aria-label="Cerrar" onClick={onCerrar}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      {total > 1 && (
        <>
          <button type="button" className="lightbox-btn lightbox-anterior" aria-label="Foto anterior" onClick={() => cambiar(-1)}>
            <svg aria-hidden="true"><use href="#i-chevron" transform="scale(-1,1) translate(-24,0)" /></svg>
          </button>
          <button type="button" className="lightbox-btn lightbox-siguiente" aria-label="Foto siguiente" onClick={() => cambiar(1)}>
            <svg aria-hidden="true"><use href="#i-chevron" /></svg>
          </button>
        </>
      )}

      <figure className="lightbox-figura">
        {/* key: al cambiar de foto se crea otra <img> y no se ve la anterior mientras carga la nueva. */}
        <img key={foto.src} className="lightbox-img" src={foto.src} alt={foto.alt} />
        <figcaption className="lightbox-pie">
          {foto.tag && <span className="lightbox-tag">{foto.tag}</span>}
          {foto.label && <span>{foto.label}</span>}
          {/* El contador también avisa al lector de pantalla qué foto se está viendo. */}
          <span className="lightbox-contador" aria-live="polite">
            {total > 1 ? `Foto ${indice + 1} de ${total}` : ""}
          </span>
        </figcaption>
      </figure>
    </div>,
    document.body
  );
}
