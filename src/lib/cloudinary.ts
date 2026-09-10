// Subida y borrado de imágenes en Cloudinary sin SDK: la API REST de Cloudinary
// acepta peticiones firmadas (SHA-1 de los parámetros + api_secret), así que solo
// se necesita fetch y el hasher que ya trae Bun.

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

// Se valida de forma perezosa (no al importar) para que el servidor arranque aunque
// Cloudinary todavía no esté configurado; solo falla al intentar subir/borrar.
function getConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary no está configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en tu archivo .env (ver .env.example)."
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: process.env.CLOUDINARY_FOLDER || "show-company/gallery",
  };
}

// Firma Cloudinary: parámetros ordenados alfabéticamente como "k=v" unidos por "&",
// con el api_secret pegado al final, y de todo eso el hash SHA-1 en hexadecimal.
function sign(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return new Bun.CryptoHasher("sha1").update(toSign + apiSecret).digest("hex");
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const { cloudName, apiKey, apiSecret, folder } = getConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ folder, timestamp }, apiSecret);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message: string };
  };

  if (!res.ok || !data.secure_url || !data.public_id) {
    throw new Error(data.error?.message ?? "No se pudo subir la imagen a Cloudinary.");
  }

  return { url: data.secure_url, publicId: data.public_id };
}

export async function deleteImage(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { result?: string };

  // "ok" = borrada; "not found" = ya no estaba, lo tratamos como éxito idempotente.
  if (data.result !== "ok" && data.result !== "not found") {
    throw new Error("No se pudo eliminar la imagen de Cloudinary.");
  }
}
