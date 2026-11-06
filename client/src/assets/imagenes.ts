// Generado por scripts/optimizar-imagenes.ts a partir de imagenes-originales/. No editar a mano:
// para cambiar o agregar una foto, ponla en imagenes-originales/ y vuelve a correr el script.
import animacionEvento480 from "./img/animacion-evento-480.webp";
import animacionEvento720 from "./img/animacion-evento-720.webp";
import animacionEvento900 from "./img/animacion-evento-900.jpg";
import aveTematico480 from "./img/ave-tematico-480.webp";
import aveTematico720 from "./img/ave-tematico-720.webp";
import aveTematico900 from "./img/ave-tematico-900.jpg";
import bodasAnillosBn480 from "./img/bodas-anillos-bn-480.webp";
import bodasAnillosBn720 from "./img/bodas-anillos-bn-720.webp";
import bodasAnillosBn900 from "./img/bodas-anillos-bn-900.jpg";
import bodasAnillosColor480 from "./img/bodas-anillos-color-480.webp";
import bodasAnillosColor720 from "./img/bodas-anillos-color-720.webp";
import bodasAnillosColor900 from "./img/bodas-anillos-color-900.jpg";
import carnavalPlumas480 from "./img/carnaval-plumas-480.webp";
import carnavalPlumas720 from "./img/carnaval-plumas-720.webp";
import carnavalPlumas900 from "./img/carnaval-plumas-900.jpg";
import corporativo480 from "./img/corporativo-480.webp";
import corporativo720 from "./img/corporativo-720.webp";
import corporativo960 from "./img/corporativo-960.webp";
import corporativo1280 from "./img/corporativo-1280.webp";
import corporativo1600 from "./img/corporativo-1600.jpg";
import espectaculosRobots480 from "./img/espectaculos-robots-480.webp";
import espectaculosRobots720 from "./img/espectaculos-robots-720.webp";
import espectaculosRobots960 from "./img/espectaculos-robots-960.webp";
import espectaculosRobots1200 from "./img/espectaculos-robots-1200.jpg";
import logo192 from "./img/logo-192.webp";
import navidad480 from "./img/navidad-480.webp";
import navidad720 from "./img/navidad-720.webp";
import navidad960 from "./img/navidad-960.webp";
import navidad1280 from "./img/navidad-1280.webp";
import navidad1600 from "./img/navidad-1600.jpg";
import nosotrosBanner480 from "./img/nosotros-banner-480.webp";
import nosotrosBanner720 from "./img/nosotros-banner-720.webp";
import nosotrosBanner900 from "./img/nosotros-banner-900.jpg";
import quinceAlicia480 from "./img/quince-alicia-480.webp";
import quinceAlicia720 from "./img/quince-alicia-720.webp";
import quinceAlicia960 from "./img/quince-alicia-960.webp";
import quinceAlicia1280 from "./img/quince-alicia-1280.webp";
import quinceAlicia1600 from "./img/quince-alicia-1600.jpg";
import quinceVivo480 from "./img/quince-vivo-480.webp";
import quinceVivo720 from "./img/quince-vivo-720.webp";
import quinceVivo960 from "./img/quince-vivo-960.webp";
import quinceVivo1280 from "./img/quince-vivo-1280.webp";
import quinceVivo1600 from "./img/quince-vivo-1600.jpg";

export interface ImagenResponsiva {
  // Versión más grande (la que usa el lightbox o un fondo sin srcset).
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

export const animacionEvento: ImagenResponsiva = { src: animacionEvento900, srcSet: `${animacionEvento480} 480w, ${animacionEvento720} 720w, ${animacionEvento900} 900w`, width: 900, height: 1200 };
export const aveTematico: ImagenResponsiva = { src: aveTematico900, srcSet: `${aveTematico480} 480w, ${aveTematico720} 720w, ${aveTematico900} 900w`, width: 900, height: 675 };
export const bodasAnillosBn: ImagenResponsiva = { src: bodasAnillosBn900, srcSet: `${bodasAnillosBn480} 480w, ${bodasAnillosBn720} 720w, ${bodasAnillosBn900} 900w`, width: 900, height: 1200 };
export const bodasAnillosColor: ImagenResponsiva = { src: bodasAnillosColor900, srcSet: `${bodasAnillosColor480} 480w, ${bodasAnillosColor720} 720w, ${bodasAnillosColor900} 900w`, width: 900, height: 1200 };
export const carnavalPlumas: ImagenResponsiva = { src: carnavalPlumas900, srcSet: `${carnavalPlumas480} 480w, ${carnavalPlumas720} 720w, ${carnavalPlumas900} 900w`, width: 900, height: 1200 };
export const corporativo: ImagenResponsiva = { src: corporativo1600, srcSet: `${corporativo480} 480w, ${corporativo720} 720w, ${corporativo960} 960w, ${corporativo1280} 1280w, ${corporativo1600} 1600w`, width: 1600, height: 1200 };
export const espectaculosRobots: ImagenResponsiva = { src: espectaculosRobots1200, srcSet: `${espectaculosRobots480} 480w, ${espectaculosRobots720} 720w, ${espectaculosRobots960} 960w, ${espectaculosRobots1200} 1200w`, width: 1200, height: 1600 };
export const logo = logo192;
export const navidad: ImagenResponsiva = { src: navidad1600, srcSet: `${navidad480} 480w, ${navidad720} 720w, ${navidad960} 960w, ${navidad1280} 1280w, ${navidad1600} 1600w`, width: 1600, height: 1200 };
export const nosotrosBanner: ImagenResponsiva = { src: nosotrosBanner900, srcSet: `${nosotrosBanner480} 480w, ${nosotrosBanner720} 720w, ${nosotrosBanner900} 900w`, width: 900, height: 675 };
export const quinceAlicia: ImagenResponsiva = { src: quinceAlicia1600, srcSet: `${quinceAlicia480} 480w, ${quinceAlicia720} 720w, ${quinceAlicia960} 960w, ${quinceAlicia1280} 1280w, ${quinceAlicia1600} 1600w`, width: 1600, height: 1200 };
export const quinceVivo: ImagenResponsiva = { src: quinceVivo1600, srcSet: `${quinceVivo480} 480w, ${quinceVivo720} 720w, ${quinceVivo960} 960w, ${quinceVivo1280} 1280w, ${quinceVivo1600} 1600w`, width: 1600, height: 1200 };
