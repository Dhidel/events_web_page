import type { ImgHTMLAttributes } from "react";
import type { ImagenResponsiva } from "../assets/imagenes";
import { SIZES_BANNER } from "../data/paginas";

export { SIZES_BANNER };

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

// Fondo de .page-banner: ocupa todo el ancho y es lo primero que se ve, así que se pide con
// prioridad alta (el servidor además la precarga con el mismo SIZES_BANNER; ver
// data/paginas.ts). Es decorativo (alt vacío); el oscurecido lo pone .page-banner-bg::after.
export function FondoBanner({ imagen }: { imagen: ImagenResponsiva }) {
  return (
    <div className="page-banner-bg">
      <Foto imagen={imagen} sizes={SIZES_BANNER} alt="" fetchPriority="high" />
    </div>
  );
}
