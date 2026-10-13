import mongoose from "mongoose";
import { Servicio, type ServicioAttrs } from "../models/Servicio";

// Catálogo inicial de personajes/actos con precio fijo (precio en Q, 1 hora, Ciudad Capital).
// Las batucadas llevan `artistas`: su precio es por grupo y en el cotizador la cantidad cuenta grupos.
// El orden de esta lista es el orden del catálogo (Servicios y Cotizador).
// Correr con: bun run seed-servicios (agrega --force para vaciar y recrear el catálogo).
export const SERVICIOS_INICIALES: Omit<ServicioAttrs, "activo" | "orden">[] = [
  { nombre: "Batucada Hora Loca — 3 Tamboreros", descripcion: "Música variada, interacción con los invitados, animación", categoria: "Batucadas", precio: 3800, unidad: "por hora", artistas: 3 },
  { nombre: "Batucada Hora Loca — 6 Tamboreros", descripcion: "Música variada, interacción con los invitados, animación", categoria: "Batucadas", precio: 6500, unidad: "por hora", artistas: 6 },
  { nombre: "Batucada Temática Brasileña", descripcion: "Batucada temática brasileña.", categoria: "Batucadas", precio: 3800, unidad: "por hora", artistas: 3 },
  { nombre: "Batucada Temática Dominicana", descripcion: "Batucada temática dominicana.", categoria: "Batucadas", precio: 3800, unidad: "por hora", artistas: 3 },
  { nombre: "Batucada Temática Chapina", descripcion: "Batucada temática chapina.", categoria: "Batucadas", precio: 3800, unidad: "por hora", artistas: 3 },
  { nombre: "Batucada Temática Colombiana", descripcion: "Batucada temática colombiana.", categoria: "Batucadas", precio: 3800, unidad: "por hora", artistas: 3 },
  { nombre: "Zanquero Iluminado", descripcion: "Baile, interacción con los invitados, animación", categoria: "Zanqueros", precio: 2500, unidad: "por hora" },
  { nombre: "Personajes de Espejos Dorados y Plateados", descripcion: "Variedad de personajes como zanqueros y de piso. Baile, interacción, animación", categoria: "Personajes", precio: 2200, unidad: "por hora" },
  { nombre: "Personajes VIP Trajes de Plumas", descripcion: "Variedad de personajes como zanqueros y de piso. Baile, interacción, animación", categoria: "Personajes", precio: 3500, unidad: "por hora" },
  { nombre: "Personajes Temáticos", descripcion: "Alicia en el País de las Maravillas, la Bella y la Bestia, cuento de hadas, princesas, hadas madrinas, rosas, mariposas y más. Bienvenida, baile, interacción, acompañamiento de fotografías", categoria: "Personajes", precio: 3500, unidad: "por hora" },
  { nombre: "Robots LED", descripcion: "Baile, interacción con los invitados, animación", categoria: "Personajes", precio: 2500, unidad: "por hora" },
  { nombre: "Zanqueras de Mariposas Iluminadas", descripcion: "Baile, interacción con los invitados, animación", categoria: "Zanqueros", precio: 2500, unidad: "por hora" },
  { nombre: "Personajes de Carnaval", descripcion: "Variedad de personajes como zanqueras y de piso. Baile, interacción, animación", categoria: "Personajes", precio: 2500, unidad: "por hora" },
  { nombre: "Cabezones de Tus Artistas Favoritos", descripcion: "KarolG, Daddy Yankee, Bad Bunny, Beele, El Alfa, Michael Jackson, Rauw, Snoop Dogg y más. Baile, interacción, animación", categoria: "Personajes", precio: 1800, unidad: "por hora" },
  { nombre: "Animals Mirror Plateados y Dorados", descripcion: "Variedad de personajes como zanqueras y de piso. Baile, interacción, animación", categoria: "Personajes", precio: 2500, unidad: "por hora" },
];

// Upsert por nombre: se puede correr las veces que haga falta sin duplicar nada.
// - Un servicio que no existe se crea completo ($setOnInsert).
// - Uno que ya existe conserva su precio, descripción, categoría, unidad y `activo` (pueden
//   haberse editado en la base). Solo se actualizan `orden` (posición en el catálogo) y
//   `artistas` cuando la lista lo define.
export async function sembrarServicios(lista = SERVICIOS_INICIALES) {
  let insertados = 0;
  for (const [orden, { artistas, ...item }] of lista.entries()) {
    const set: Partial<ServicioAttrs> = { orden };
    if (artistas !== undefined) set.artistas = artistas;
    const resultado = await Servicio.updateOne(
      { nombre: item.nombre },
      { $setOnInsert: { ...item, activo: true }, $set: set },
      { upsert: true, runValidators: true }
    );
    insertados += resultado.upsertedCount;
  }
  return { insertados, existentes: lista.length - insertados };
}

async function main() {
  // Import dinámico: db.ts exige MONGODB_URI al cargarse, y las pruebas importan este archivo
  // (sembrarServicios) sin conectarse a Atlas.
  const { connectDB } = await import("../db");
  await connectDB();

  if (process.argv.includes("--force")) {
    const { deletedCount } = await Servicio.deleteMany({});
    console.log(`Catálogo vaciado (${deletedCount} servicios eliminados por --force).`);
  }

  const { insertados, existentes } = await sembrarServicios();
  for (const item of SERVICIOS_INICIALES) {
    console.log(`· ${item.nombre} (${item.categoria})`);
  }
  console.log(`\nListo: ${insertados} servicios nuevos, ${existentes} ya existían (sus precios no se tocaron).`);
  await mongoose.disconnect();
  process.exit(0);
}

if (import.meta.main) main();
