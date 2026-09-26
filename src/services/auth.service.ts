import { AdminUser } from "../models/AdminUser";

export async function validarCredencialesAdmin(email: string, passwordPlano: string) {
  const user = await AdminUser.findOne({ email }).select("+password");
  if (!user) return null;

  const esValido = await user.comparePassword(passwordPlano);
  if (!esValido) return null;

  return {
    id: user.id as string,
    email: user.email as string,
  };
}