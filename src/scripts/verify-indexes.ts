import mongoose from "mongoose";
import { connectDB } from "../db";
import { AdminUser } from "../models/AdminUser";
import { GalleryImage } from "../models/GalleryImage";
import { Servicio } from "../models/Servicio";
import { Solicitud } from "../models/Solicitud";

// Busca en el plan ganador la etapa que lee datos: IXSCAN (usa índice) o COLLSCAN (recorre todo).
function findScan(stage: any): { stage: string; indexName?: string } {
  if (!stage) return { stage: "?" };
  if (stage.stage === "IXSCAN" || stage.stage === "COLLSCAN" || stage.stage === "EXPRESS_IXSCAN") {
    return { stage: stage.stage, indexName: stage.indexName };
  }
  return findScan(stage.inputStage ?? stage.inputStages?.[0]);
}

// Las mismas consultas que hacen los servicios (src/services/).
const QUERIES: [string, () => Promise<any>][] = [
  ["listarSolicitudes()", () => Solicitud.find({}).sort({ createdAt: -1 }).explain()],
  ["listarSolicitudes(estado)", () => Solicitud.find({ estado: "nuevo" }).sort({ createdAt: -1 }).explain()],
  ["listarImagenesGaleria()", () => GalleryImage.find().sort({ order: 1, createdAt: 1 }).explain()],
  ["galería por categoría", () => GalleryImage.find({ category: "bodas" }).sort({ order: 1, createdAt: 1 }).explain()],
  ["listarServiciosActivos()", () => Servicio.find({ activo: true }).sort({ orden: 1, createdAt: 1 }).explain()],
  [
    "listarServiciosActivos(categoria)",
    () => Servicio.find({ activo: true, categoria: "Batucadas" }).sort({ orden: 1, createdAt: 1 }).explain(),
  ],
  ["validarCredencialesAdmin(email)", () => AdminUser.findOne({ email: "admin@example.com" }).explain()],
];

async function verify() {
  await connectDB();

  for (const [nombre, run] of QUERIES) {
    const exp = await run();
    const plan = Array.isArray(exp) ? exp[0] : exp;
    const scan = findScan(plan.queryPlanner.winningPlan.queryPlan ?? plan.queryPlanner.winningPlan);
    const resultado = scan.indexName ? `${scan.stage} → ${scan.indexName}` : `${scan.stage} (sin índice)`;
    console.log(`${nombre.padEnd(36)} ${resultado}`);
  }

  await mongoose.disconnect();
}

verify().catch(console.error);
