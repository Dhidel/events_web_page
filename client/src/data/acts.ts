export interface Act {
  id: string;
  name: string;
  includes: string;
  price: number | null;
  note?: string;
}

export const ACTS: Act[] = [
  {
    id: "batucada3",
    name: "Batucada Hora Loca — 3 Tamboreros",
    includes: "Música variada, interacción con los invitados, animación",
    price: 3800,
  },
  {
    id: "batucada6",
    name: "Batucada Hora Loca — 6 Tamboreros",
    includes: "Música variada, interacción con los invitados, animación",
    price: 6500,
  },
  {
    id: "batucadas-tematicas",
    name: "Batucadas Temáticas",
    includes: "Brasileña, Dominicana, Chapina, Colombiana",
    price: null,
    note: "Diferentes precios según temática — cotiza por WhatsApp",
  },
  {
    id: "zanquero",
    name: "Zanquero Iluminado",
    includes: "Baile, interacción con los invitados, animación",
    price: 2500,
  },
  {
    id: "espejos",
    name: "Personajes de Espejos Dorados y Plateados",
    includes: "Variedad de personajes como zanqueros y de piso. Baile, interacción, animación",
    price: 2200,
  },
  {
    id: "plumas",
    name: "Personajes VIP Trajes de Plumas",
    includes: "Variedad de personajes como zanqueros y de piso. Baile, interacción, animación",
    price: 3500,
  },
  {
    id: "tematicos",
    name: "Personajes Temáticos",
    includes:
      "Alicia en el País de las Maravillas, la Bella y la Bestia, cuento de hadas, princesas, hadas madrinas, rosas, mariposas y más. Bienvenida, baile, interacción, acompañamiento de fotografías",
    price: 3500,
  },
  {
    id: "robots",
    name: "Robots LED",
    includes: "Baile, interacción con los invitados, animación",
    price: 2500,
  },
  {
    id: "mariposas",
    name: "Zanqueras de Mariposas Iluminadas",
    includes: "Baile, interacción con los invitados, animación",
    price: 2500,
  },
  {
    id: "carnaval",
    name: "Personajes de Carnaval",
    includes: "Variedad de personajes como zanqueras y de piso. Baile, interacción, animación",
    price: 2500,
  },
  {
    id: "cabezones",
    name: "Cabezones de Tus Artistas Favoritos",
    includes:
      "KarolG, Daddy Yankee, Bad Bunny, Beele, El Alfa, Michael Jackson, Rauw, Snoop Dogg y más. Baile, interacción, animación",
    price: 1800,
  },
  {
    id: "animals",
    name: "Animals Mirror Plateados y Dorados",
    includes: "Variedad de personajes como zanqueras y de piso. Baile, interacción, animación",
    price: 2500,
  },
];
