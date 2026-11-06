import { maskEmail } from "../lib/privacy";

const LOGIN_URL = "http://localhost:3000/api/auth/login";

// Las credenciales de prueba se leen del .env (nunca se escriben en el código):
//   TEST_ADMIN_EMAIL=...
//   TEST_ADMIN_PASSWORD=...
const TEST_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

async function tryLogin(email: string, password: string) {
  const body = { email, password };
  // Nunca se imprime la contraseña; el correo va enmascarado.
  console.log(`Enviando: { email: "${maskEmail(email)}", password: "********" }`);

  let res: Response;
  try {
    res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("No se pudo conectar al servidor. ¿Está corriendo con 'bun run dev'?", error);
    process.exit(1);
  }

  const data = (await res.json()) as { token?: string; error?: string };
  console.log(`Status: ${res.status} ${res.statusText}`);
  // El token da acceso al panel admin: solo se indica si llegó.
  console.log("Respuesta:", data.token ? { token: `${data.token.slice(0, 10)}… (recibido)` } : data);
}

async function main() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.error("Define TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en tu archivo .env.");
    process.exit(1);
  }

  console.log("=== Prueba 1: credenciales correctas ===");
  await tryLogin(TEST_EMAIL, TEST_PASSWORD);

  console.log("\n=== Prueba 2: misma cuenta, contraseña incorrecta ===");
  await tryLogin(TEST_EMAIL, "contraseña-incorrecta-a-proposito");
}

main();
