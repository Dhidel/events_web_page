// Páginas públicas del sitio: única fuente de verdad para el SEO.
// - El servidor (src/lib/seo.ts) arma con esta tabla el sitemap.xml y el <head> de cada
//   página (título, descripción, canonical y vista previa al compartir el enlace).
// - El cliente (components/Layout.tsx) actualiza el título de la pestaña al navegar.
// - fotoPrincipal: la foto grande de arriba (lo que mide el LCP). El servidor la precarga desde
//   el <head> para no esperar a que React la dibuje: si cambia la foto de una página, cambiarla
//   aquí también (con otra foto se descargarían dos).
// Una página nueva se agrega aquí y en App.tsx. Sin imports: la usa también el servidor.

// Ancho que ocupa la foto de fondo de los banners (FondoBanner en components/Foto.tsx). En celular
// el banner mide ~390x545: con object-fit: cover una foto 4:3 se escala por el alto y ocupa
// ~730px de ancho (se recorta por los lados), no 100vw.
export const SIZES_BANNER = "(max-width: 680px) 730px, 100vw";

// nombre: el de la foto en client/imagenes-originales (sin extensión). Sin sizes, la página usa
// solo la versión más grande (sin srcset), como el carrusel del inicio.
export interface FotoPrincipal {
  nombre: string;
  sizes?: string;
}

export interface PaginaPublica {
  title: string;
  description: string;
  fotoPrincipal?: FotoPrincipal;
}

export const PAGINAS_PUBLICAS: Record<string, PaginaPublica> = {
  "/": {
    title: "Show Company | Producción de eventos y entretenimiento en Guatemala",
    description:
      "Más de 25 años produciendo eventos en Guatemala: personajes, espectáculos y animación para bodas, quinceañeras, fiestas infantiles y eventos corporativos.",
    fotoPrincipal: { nombre: "quince-alicia" },
  },
  "/servicios": {
    title: "Servicios y espectáculos | Show Company",
    description:
      "Personajes, actos y espectáculos por hora para quinceañeras, bodas, fiestas navideñas y eventos de empresa en Guatemala.",
    fotoPrincipal: { nombre: "corporativo", sizes: SIZES_BANNER },
  },
  "/cotizador": {
    title: "Precios de hora loca y shows para eventos | Show Company",
    description:
      "Cotiza en línea: elige personajes y actos y calcula al momento el precio de tu evento en Guatemala. Un asesor confirma el total por WhatsApp.",
    fotoPrincipal: { nombre: "animacion-evento", sizes: SIZES_BANNER },
  },
  "/galeria": {
    title: "Fotos de bodas, XV años y eventos en Guatemala | Show Company",
    description:
      "Fotos de eventos reales de Show Company: bodas, XV años, eventos corporativos, hora loca y espectáculos. Filtra por categoría.",
    fotoPrincipal: { nombre: "animacion-evento", sizes: SIZES_BANNER },
  },
  "/nosotros": {
    title: "Nosotros | Show Company",
    description:
      "Desde 1996 creando momentos felices: conoce la historia, los valores y el equipo de Show Company, empresa formal de eventos en Guatemala.",
    fotoPrincipal: { nombre: "nosotros-banner", sizes: SIZES_BANNER },
  },
  "/contacto": {
    title: "Contacto | Show Company",
    description:
      "Escríbenos por WhatsApp al +502 3073 8716 o visítanos en 8 avenida 0-61 zona 2, Guatemala. Cuéntanos tu evento y te asesoramos.",
    fotoPrincipal: { nombre: "ave-tematico", sizes: SIZES_BANNER },
  },
};

export const TITULO_POR_DEFECTO = PAGINAS_PUBLICAS["/"]!.title;
