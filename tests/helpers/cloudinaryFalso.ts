// Reemplazo de src/lib/cloudinary.ts para las pruebas (se instala en tests/setup.ts con
// mock.module): ninguna prueba sube ni borra imágenes reales con las credenciales de .env.

export const cloudinaryFalso = {
  subidas: [] as string[],
  borradas: [] as string[],
  reiniciar() {
    this.subidas = [];
    this.borradas = [];
  },
};

export async function uploadImage(file: File) {
  cloudinaryFalso.subidas.push(file.name);
  return { url: `https://res.cloudinary.com/falso/${file.name}`, publicId: `falso/${file.name}` };
}

export async function deleteImage(publicId: string) {
  cloudinaryFalso.borradas.push(publicId);
}
