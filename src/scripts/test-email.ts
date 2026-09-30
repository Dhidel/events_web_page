import { resend } from "../lib/resend";

async function run() {
  console.log("Enviando correo de prueba con Resend...");

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: [process.env.EMAIL_TO_NOTIFY || "djosorio@ufm.edu"],
      subject: "Prueba Spike [10.1] - Show Company",
      html: `
        <h2>¡Integración de Resend completada!</h2>
        <p>Este correo confirma que el backend puede enviar correos transaccionales sin exponer credenciales.</p>
        <p><strong>Fecha y hora:</strong> ${new Date().toLocaleString()}</p>
      `,
    });

    if (error) {
      console.error("❌ Resend devolvió un error:", error);
      return;
    }

    console.log(" Correo enviado con éxito:", data);
  } catch (err) {
    console.error("❌ Excepción al intentar enviar:", err);
  }
}

run();