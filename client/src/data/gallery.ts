import quinceVivo from "../assets/img/quince-vivo.jpg";
import quinceAlicia from "../assets/img/quince-alicia.jpg";
import bodasColor from "../assets/img/bodas-anillos-color.jpg";
import bodasBn from "../assets/img/bodas-anillos-bn.jpg";
import corporativo from "../assets/img/corporativo.jpg";
import navidad from "../assets/img/navidad.jpg";
import espectaculosRobots from "../assets/img/espectaculos-robots.jpg";
import carnavalPlumas from "../assets/img/carnaval-plumas.jpg";
import aveTematico from "../assets/img/ave-tematico.jpg";
import animacionEvento from "../assets/img/animacion-evento.jpg";

export interface GalleryItem {
  id: string;
  img: string;
  alt: string;
  category: "quinceaneras" | "bodas" | "corporativo" | "navidad" | "espectaculos";
  categoryLabel: string;
  label: string;
}

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "g1",
    img: quinceVivo,
    alt: "Quinceañera con personajes en vivo",
    category: "quinceaneras",
    categoryLabel: "Quinceaños",
    label: "Producción de fantasía con personajes dorados",
  },
  {
    id: "g2",
    img: quinceAlicia,
    alt: "Producción temática de Alicia en el País de las Maravillas",
    category: "quinceaneras",
    categoryLabel: "Quinceaños",
    label: "Producción temática · Alicia en el País de las Maravillas",
  },
  {
    id: "g3",
    img: bodasColor,
    alt: "Anillos de bodas a color",
    category: "bodas",
    categoryLabel: "Bodas",
    label: "Elegancia de época en cada detalle",
  },
  {
    id: "g4",
    img: bodasBn,
    alt: "Manos de novios con anillos en blanco y negro",
    category: "bodas",
    categoryLabel: "Bodas",
    label: "Bienvenida con estilo para los invitados",
  },
  {
    id: "g5",
    img: corporativo,
    alt: "Bailarinas con vestuario de lámpara/candelabro",
    category: "corporativo",
    categoryLabel: "Corporativo",
    label: "Ambientación de gala para evento empresarial",
  },
  {
    id: "g6",
    img: navidad,
    alt: "Personajes navideños en centro comercial",
    category: "navidad",
    categoryLabel: "Navidad",
    label: "Elfos y personajes navideños en escena",
  },
  {
    id: "g7",
    img: espectaculosRobots,
    alt: "Personajes de mascarón para espectáculo",
    category: "espectaculos",
    categoryLabel: "Espectáculos",
    label: "Escuadrón de robots LED",
  },
  {
    id: "g8",
    img: carnavalPlumas,
    alt: "Bailarina de carnaval con tocado de plumas",
    category: "espectaculos",
    categoryLabel: "Espectáculos",
    label: "Personajes en zancos, temática circense",
  },
  {
    id: "g9",
    img: aveTematico,
    alt: "Personaje con traje temático de ave",
    category: "espectaculos",
    categoryLabel: "Espectáculos",
    label: "Personajes en zancos, temática dorada",
  },
  {
    id: "g10",
    img: animacionEvento,
    alt: "Bailarinas con vestuario de animación en evento",
    category: "espectaculos",
    categoryLabel: "Espectáculos",
    label: "Cabezones de personajes urbanos",
  },
];
