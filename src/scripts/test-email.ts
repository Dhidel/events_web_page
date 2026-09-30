import { enviarCorreoNotificacion } from "../services/email.service";

async function main() {
  console.log("Probando enviarCorreoNotificacion con plantilla HTML...");

  try {
    const res = await enviarCorreoNotificacion({
      nombre: "Carlos Gómez",
      telefono: "+502 5555-1234",
      correo: "carlos@ejemplo.com",
      tipoEvento: "Boda",
      fechaEvento: "2026-12-15",
      mensaje: "Hola, me interesa conocer la disponibilidad para un show de luces y pirotecnia fría.",
      origen: "contacto",
    });

    console.log(" Resultado:", res);
  } catch (err) {
    console.error(" Error en la prueba:", err);
  }
}

main();