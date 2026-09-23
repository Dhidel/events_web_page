import mongoose from "mongoose";
import { connectDB } from "../db";
import { Servicio, type ServicioAttrs } from "../models/Servicio";

// Los 11 personajes/actos con precio fijo que hoy están hardcodeados en
// client/src/data/acts.ts (precio en Q, por personaje, 1 hora, Ciudad Capital).
// "Batucadas Temáticas" no se incluye porque no tiene precio fijo (se cotiza por WhatsApp).
// Correr con: bun run seed-servicios (agrega --force para vaciar y recrear el catálogo).
const SEED: Omit<ServicioAttrs, "activo" | "orden">[] = [
  { nombre: "Batucada Hora Loca — 3 Tamboreros", descripcion: "Música variada, interacción con los invitados, animación", categoria: "Batucadas", precio: 3800, unidad: "por hora" },
  { nombre: "Batucada Hora Loca — 6 Tamboreros", descripcion: "Música variada, interacción con los invitados, animación", categoria: "Batucadas", precio: 6500, unidad: "por hora" },
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

async function main() {
  await connectDB();

  const existing = await Servicio.estimatedDocumentCount();
  const force = process.argv.includes("--force");

  if (existing > 0 && !force) {
    console.log(
      `El catálogo ya tiene ${existing} servicios. No se hace nada. Usá "--force" para vaciarlo y recrearlo.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  if (force && existing > 0) {
    await Servicio.deleteMany({});
    console.log(`Catálogo vaciado (${existing} servicios eliminados por --force).`);
  }

  let orden = 0;
  for (const item of SEED) {
    await Servicio.create({ ...item, activo: true, orden: orden++ });
    console.log(`✓ ${item.nombre} (${item.categoria}) — Q${item.precio} ${item.unidad}`);
  }

  console.log(`\nListo: ${SEED.length} servicios insertados.`);
  await mongoose.disconnect();
  process.exit(0);
}

main();
