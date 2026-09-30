import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("⚠ [Resend] Advertencia: RESEND_API_KEY no está configurada en el archivo .env.");
}

export const resend = new Resend(apiKey);