// Reemplazo de src/lib/cloudinary.ts para las pruebas (se instala en tests/setup.ts con
// mock.module): ninguna prueba sube ni borra imágenes reales con las credenciales de .env.

export const cloudinaryFalso = {
  subidas: [] as string[],
  borradas: [] as string[],
  // Si no es null, subir y borrar fallan con este error (simula que Cloudinary falla).
  fallarCon: null as Error | null,
  reiniciar() {
    this.subidas = [];
    this.borradas = [];
    this.fallarCon = null;
  },
};

export async function uploadImage(file: File) {
  if (cloudinaryFalso.fallarCon) throw cloudinaryFalso.fallarCon;
  cloudinaryFalso.subidas.push(file.name);
  return { url: `https://res.cloudinary.com/falso/${file.name}`, publicId: `falso/${file.name}` };
}

export async function deleteImage(publicId: string) {
  if (cloudinaryFalso.fallarCon) throw cloudinaryFalso.fallarCon;
  cloudinaryFalso.borradas.push(publicId);
}
