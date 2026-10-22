import { AdminUser } from "../models/AdminUser";

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export async function validarCredencialesAdmin(email: string, passwordPlano: string) {
  const user = await AdminUser.findOne({ email }).select("+password");
  if (!user) return null;

  const esValido = await user.comparePassword(passwordPlano);
  if (!esValido) return null;

  return {
    id: user.id as string,
    email: user.email as string,
    versionSesion: user.versionSesion,
  };
}

// Lo que va dentro del JWT del panel. `v` permite revocar los tokens ya emitidos.
export function payloadDeSesion(user: { id: string; email: string; versionSesion: number }) {
  return { id: user.id, email: user.email, v: user.versionSesion };
}

// Una firma válida no basta: el admin tiene que seguir existiendo en la base y el token tiene
// que ser de su versión de sesión actual. Así, borrar un admin o correr revocar-sesiones corta
// al instante cualquier token suyo, aunque todavía no haya expirado. Los tokens sin `v`
// (emitidos antes de este cambio) se rechazan.
export async function sesionAdminVigente(payload: Record<string, unknown>): Promise<boolean> {
  const { id, v } = payload;
  if (typeof id !== "string" || !OBJECT_ID_RE.test(id) || typeof v !== "number") return false;

  // Los admins creados antes de que existiera versionSesion no tienen el campo en la base
  // (null en la consulta): equivale a la versión 0.
  const version = v === 0 ? { $in: [0, null] } : v;
  return (await AdminUser.exists({ _id: id, versionSesion: version })) !== null;
}

// Invalida todos los tokens emitidos para ese correo. Devuelve false si el admin no existe.
export async function revocarSesionesAdmin(email: string): Promise<boolean> {
  const res = await AdminUser.updateOne({ email: email.trim().toLowerCase() }, { $inc: { versionSesion: 1 } });
  return res.matchedCount > 0;
}
