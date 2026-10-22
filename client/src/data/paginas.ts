// Páginas públicas del sitio: única fuente de verdad para el SEO.
// - El servidor (src/lib/seo.ts) arma con esta tabla el sitemap.xml y el <head> de cada
//   página (título, descripción, canonical y vista previa al compartir el enlace).
// - El cliente (components/Layout.tsx) actualiza el título de la pestaña al navegar.
// Una página nueva se agrega aquí y en App.tsx. Sin imports: la usa también el servidor.

export interface PaginaPublica {
  title: string;
  description: string;
}

export const PAGINAS_PUBLICAS: Record<string, PaginaPublica> = {
  "/": {
    title: "Show Company | Producción de eventos y entretenimiento en Guatemala",
    description:
      "Más de 25 años produciendo eventos en Guatemala: personajes, espectáculos y animación para bodas, quinceañeras, fiestas infantiles y eventos corporativos.",
  },
  "/servicios": {
    title: "Servicios y espectáculos | Show Company",
    description:
      "Personajes, actos y espectáculos por hora para quinceañeras, bodas, fiestas navideñas y eventos de empresa en Guatemala.",
  },
  "/cotizador": {
    title: "Cotiza tu evento | Show Company",
    description:
      "Elige personajes y actos, y calcula al momento el precio de tu evento con nuestras tarifas por hora. Un asesor confirma el total por WhatsApp.",
  },
  "/galeria": {
    title: "Galería de eventos | Show Company",
    description:
      "Fotos de eventos reales de Show Company: bodas, quinceañeras, eventos corporativos y espectáculos. Filtra por categoría.",
  },
  "/nosotros": {
    title: "Nosotros | Show Company",
    description:
      "Desde 1996 creando momentos felices: conoce la historia, los valores y el equipo de Show Company, empresa formal de eventos en Guatemala.",
  },
  "/contacto": {
    title: "Contacto | Show Company",
    description:
      "Escríbenos por WhatsApp al +502 3073 8716 o visítanos en 8 avenida 0-61 zona 2, Guatemala. Cuéntanos tu evento y te asesoramos.",
  },
};

export const TITULO_POR_DEFECTO = PAGINAS_PUBLICAS["/"]!.title;
