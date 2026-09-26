import { Servicio } from "../models/Servicio";

export async function listarServiciosActivos(categoria?: string) {
  const filtro: Record<string, unknown> = { activo: true };
  if (categoria) filtro.categoria = categoria;

  return await Servicio.find(filtro).sort({ orden: 1, createdAt: 1 });
}