const LOGIN_URL = "http://localhost:3000/api/auth/login";

async function tryLogin(email: string, password: string) {
  const body = { email, password };
  console.log("Enviando:", JSON.stringify(body));

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

  const data = await res.json();
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log("Respuesta:", data);
}

async function main() {
  console.log("=== Prueba 1: credenciales correctas ===");
  await tryLogin("mishellemolinaarana@gmail.com", "20253030");

  console.log("\n=== Prueba 2: misma cuenta, contraseña incorrecta ===");
  await tryLogin("mishellemolinaarana@gmail.com", "contraseña-incorrecta-a-proposito");
}

main();
