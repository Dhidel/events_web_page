import mongoose from "mongoose";
import { connectDB } from "../db";
import { AdminUser } from "../models/AdminUser";

async function main() {
  const email = prompt("Correo del administrador:")?.trim();
  const name = prompt("Nombre del administrador:")?.trim();
  const password = prompt("Contraseña:")?.trim();

  if (!email || !name || !password) {
    console.error("Correo, nombre y contraseña son obligatorios.");
    process.exit(1);
  }

  await connectDB();

  const existing = await AdminUser.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.error(`Ya existe un administrador con el correo ${email}.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const admin = await AdminUser.create({ email, name, password });
  console.log(`Administrador "${admin.name}" (${admin.email}) creado correctamente.`);

  await mongoose.disconnect();
  process.exit(0);
}

main();
