import mongoose from "mongoose";
import { connectDB } from "../db";
import { Solicitud } from "../models/Solicitud";

async function verify() {
  await connectDB();

  const exp: any = await Solicitud.find({ estado: "nuevo" })
    .sort({ createdAt: -1 })
    .explain("executionStats");

  const winningPlan = exp.queryPlanner.winningPlan;
  console.log("Stage principal:", winningPlan.stage);
  console.log("Stage de búsqueda (inputStage):", winningPlan.inputStage?.stage ?? winningPlan.stage);
  console.log("Índice utilizado:", winningPlan.inputStage?.indexName ?? winningPlan.indexName ?? "Ninguno (COLLSCAN)");

  await mongoose.disconnect();
}

verify().catch(console.error);