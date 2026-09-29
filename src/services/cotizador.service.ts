import { Servicio } from "../models/Servicio";

// Límite por personaje; coincide con el del frontend (Cotizador.tsx).
export const MAX_CANTIDAD_POR_SERVICIO = 20;

export interface PersonajeSeleccionado {
  servicioId: string;
  cantidad: number;
}

export interface ServicioConPrecio {
  id: string;
  nombre: string;
  precio: number;
}

export interface LineaEstimado {
  servicioId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface DetalleCotizador {
  personajes: LineaEstimado[];
  total: number;
}

// Selección que no se puede cotizar (servicio inexistente, cantidades fuera de rango...).
// El mensaje es apto para mostrarse al usuario.
export class SeleccionInvalidaError extends Error {}

// Cálculo puro del estimado: cantidad × precio de cada servicio, sumado. Las líneas con
// cantidad 0 se descartan. Lanza SeleccionInvalidaError si algo no se puede cotizar.
export function calcularEstimado(servicios: ServicioConPrecio[], seleccion: PersonajeSeleccionado[]): DetalleCotizador {
  const porId = new Map(servicios.map((s) => [s.id, s]));
  const vistos = new Set<string>();
  const personajes: LineaEstimado[] = [];

  for (const { servicioId, cantidad } of seleccion) {
    if (vistos.has(servicioId)) throw new SeleccionInvalidaError("Un personaje aparece más de una vez en la cotización.");
    vistos.add(servicioId);

    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > MAX_CANTIDAD_POR_SERVICIO) {
      throw new SeleccionInvalidaError(`Las cantidades deben ser números enteros entre 0 y ${MAX_CANTIDAD_POR_SERVICIO}.`);
    }
    if (cantidad === 0) continue;

    const servicio = porId.get(servicioId);
    if (!servicio) throw new SeleccionInvalidaError("Uno de los personajes seleccionados ya no está disponible.");

    personajes.push({
      servicioId,
      nombre: servicio.nombre,
      cantidad,
      precioUnitario: servicio.precio,
      subtotal: cantidad * servicio.precio,
    });
  }

  if (personajes.length === 0) throw new SeleccionInvalidaError("Selecciona al menos un personaje.");

  const total = personajes.reduce((suma, linea) => suma + linea.subtotal, 0);
  return { personajes, total };
}

// Arma el detalle del cotizador con los precios que hay en MongoDB en este momento.
// El total (y nombres/subtotales) que mande el cliente se ignoran: siempre se recalculan aquí.
export async function recalcularDetalleCotizador(seleccion: PersonajeSeleccionado[]): Promise<DetalleCotizador> {
  const ids = [...new Set(seleccion.map((p) => p.servicioId))];
  const docs = await Servicio.find({ _id: { $in: ids }, activo: true });
  const servicios = docs.map((d) => ({ id: d.id as string, nombre: d.nombre, precio: d.precio }));
  return calcularEstimado(servicios, seleccion);
}
