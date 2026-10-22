import mongoose from "mongoose";
import { connectDB } from "../db";
import { revocarSesionesAdmin } from "../services/auth.service";

// Cierra todas las sesiones abiertas de un admin (p. ej. si perdió la laptop o se sospecha
// que le robaron el token): los tokens ya emitidos dejan de servir al instante.
async function main() {
  const email = prompt("Correo del administrador:")?.trim();
  if (!email) {
    console.error("El correo es obligatorio.");
    process.exit(1);
  }

  await connectDB();
  const ok = await revocarSesionesAdmin(email);
  await mongoose.disconnect();

  if (!ok) {
    console.error(`No existe un administrador con el correo ${email}.`);
    process.exit(1);
  }
  console.log(`Sesiones de ${email} cerradas. Tendrá que volver a iniciar sesión.`);
  process.exit(0);
}

main();
