import type { ImgHTMLAttributes } from "react";
import type { ImagenResponsiva } from "../assets/imagenes";

// <img> con srcset: el navegador baja la versión más chica que cubre el tamaño en pantalla.
// `sizes` debe describir el ancho real que ocupa la foto según el CSS; si se queda corto, se
// elige una versión menor y la foto se ve borrosa. width/height solo dan la proporción
// (el CSS de cada sección fija el tamaño).
export default function Foto({
  imagen,
  sizes,
  ...props
}: { imagen: ImagenResponsiva; sizes: string; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet">) {
  return (
    <img
      src={imagen.src}
      srcSet={imagen.srcSet}
      sizes={sizes}
      width={imagen.width}
      height={imagen.height}
      decoding="async"
      {...props}
    />
  );
}

// En celular el banner mide ~390x545: con object-fit: cover una foto 4:3 se escala por el alto y
// ocupa ~730px de ancho (se recorta por los lados), no 100vw.
export const SIZES_BANNER = "(max-width: 680px) 730px, 100vw";

// Fondo de .page-banner: ocupa todo el ancho y es lo primero que se ve, así que se pide con
// prioridad alta. Es decorativo (alt vacío); el oscurecido lo pone .page-banner-bg::after.
export function FondoBanner({ imagen }: { imagen: ImagenResponsiva }) {
  return (
    <div className="page-banner-bg">
      <Foto imagen={imagen} sizes={SIZES_BANNER} alt="" fetchPriority="high" />
    </div>
  );
}
