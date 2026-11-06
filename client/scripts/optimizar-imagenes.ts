// Genera las imágenes del sitio a partir de client/imagenes-originales:
// - una versión WebP por cada ancho de ANCHOS menor que la original en src/assets/img/; la versión
//   de tamaño completo es la original tal cual (ya viene comprimida: recomprimirla casi no ahorra
//   y sí agrega pérdida),
// - src/assets/imagenes.ts con src, srcSet, width y height de cada foto (lo importan las páginas),
// - el logo en 192 px y WebP sin pérdida (se muestra a 38-56 px; 192 cubre pantallas 3x),
// - public/og-image.jpg recomprimida (las redes no siempre aceptan WebP en la vista previa).
// Cada versión se compara con la original redimensionada sin pérdida (SSIM sobre la luminancia):
// si no llega a SSIM_MINIMO se vuelve a comprimir con más calidad.
//
// Uso (desde client/): bun scripts/optimizar-imagenes.ts
import sharp from "sharp";
import { readdir, rm } from "node:fs/promises";

const ORIGENES = `${import.meta.dir}/../imagenes-originales`;
const DESTINO = `${import.meta.dir}/../src/assets/img`;
const MODULO = `${import.meta.dir}/../src/assets/imagenes.ts`;
const OG = `${import.meta.dir}/../public/og-image.jpg`;

const ANCHOS = [480, 720, 960, 1280];
const LADO_LOGO = 192;
const CALIDAD_INICIAL = 80;
const CALIDAD_MAXIMA = 94;
const SSIM_MINIMO = 0.98;

// SSIM medio en ventanas de 8x8 (paso 4) sobre la luminancia de dos imágenes del mismo tamaño.
function ssim(a: Buffer, b: Buffer, ancho: number, alto: number): number {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  let suma = 0, ventanas = 0;
  for (let y = 0; y + 8 <= alto; y += 4) {
    for (let x = 0; x + 8 <= ancho; x += 4) {
      let ma = 0, mb = 0;
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const k = (y + j) * ancho + x + i;
        ma += a[k]!; mb += b[k]!;
      }
      ma /= 64; mb /= 64;
      let va = 0, vb = 0, cov = 0;
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const k = (y + j) * ancho + x + i;
        const da = a[k]! - ma, db = b[k]! - mb;
        va += da * da; vb += db * db; cov += da * db;
      }
      va /= 63; vb /= 63; cov /= 63;
      suma += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      ventanas++;
    }
  }
  return suma / ventanas;
}

const luma = (img: sharp.Sharp) => img.greyscale().raw().toBuffer({ resolveWithObject: true });

// Comprime con la menor calidad que mantiene SSIM >= SSIM_MINIMO frente a la referencia sin pérdida.
async function comprimir(referencia: sharp.Sharp, codificar: (img: sharp.Sharp, q: number) => sharp.Sharp) {
  const ref = await luma(referencia.clone());
  for (let q = CALIDAD_INICIAL; ; q += 2) {
    const datos = await codificar(referencia.clone(), q).toBuffer();
    const { data } = await luma(sharp(datos));
    const valor = ssim(ref.data, data, ref.info.width, ref.info.height);
    if (valor >= SSIM_MINIMO || q >= CALIDAD_MAXIMA) return { datos, q, valor };
  }
}

const camello = (nombre: string) => nombre.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

for (const f of await readdir(DESTINO)) await rm(`${DESTINO}/${f}`);

const importaciones: string[] = [];
const exportaciones: string[] = [];

for (const archivo of (await readdir(ORIGENES)).sort()) {
  const ruta = `${ORIGENES}/${archivo}`;
  const nombre = archivo.replace(/\.\w+$/, "");
  const original = sharp(ruta).rotate();
  const { width, height } = await original.metadata();
  const pesoOriginal = Bun.file(ruta).size;

  if (nombre === "og-image") {
    const r = await comprimir(original, (img, q) => img.jpeg({ quality: q, mozjpeg: true }));
    await Bun.write(OG, r.datos);
    console.log(`og-image.jpg  ${kb(pesoOriginal)} -> ${kb(r.datos.length)}  (q${r.q}, SSIM ${r.valor.toFixed(3)})`);
    continue;
  }

  const id = camello(nombre);

  if (nombre === "logo") {
    const datos = await original.resize(LADO_LOGO, LADO_LOGO, { kernel: "lanczos3" }).webp({ lossless: true, effort: 6 }).toBuffer();
    await Bun.write(`${DESTINO}/logo-${LADO_LOGO}.webp`, datos);
    importaciones.push(`import logo${LADO_LOGO} from "./img/logo-${LADO_LOGO}.webp";`);
    exportaciones.push(`export const logo = logo${LADO_LOGO};`);
    console.log(`logo  ${kb(pesoOriginal)} -> ${kb(datos.length)}  (${LADO_LOGO}px, sin pérdida)`);
    continue;
  }

  // Anchos de ANCHOS menores que la original (WebP) y la original tal cual como la más grande.
  const anchos = ANCHOS.filter((a) => a < width!);
  const versiones: string[] = [];
  const detalle: string[] = [];
  for (const ancho of anchos) {
    const ref = original.clone().resize({ width: ancho, kernel: "lanczos3" });
    const r = await comprimir(ref, (img, q) => img.webp({ quality: q, effort: 6, smartSubsample: true }));
    const salida = `${nombre}-${ancho}.webp`;
    await Bun.write(`${DESTINO}/${salida}`, r.datos);
    importaciones.push(`import ${id}${ancho} from "./img/${salida}";`);
    versiones.push(`\${${id}${ancho}} ${ancho}w`);
    detalle.push(`${ancho}w ${kb(r.datos.length)} q${r.q} SSIM ${r.valor.toFixed(3)}`);
  }
  const extension = archivo.split(".").pop();
  await Bun.write(`${DESTINO}/${nombre}-${width}.${extension}`, Bun.file(ruta));
  importaciones.push(`import ${id}${width} from "./img/${nombre}-${width}.${extension}";`);
  versiones.push(`\${${id}${width}} ${width}w`);
  detalle.push(`${width}w original`);
  exportaciones.push(
    `export const ${id}: ImagenResponsiva = { src: ${id}${width}, srcSet: \`${versiones.join(", ")}\`, width: ${width}, height: ${height} };`
  );
  console.log(`${nombre}  ${kb(pesoOriginal)} -> ${detalle.join(" · ")}`);
}

await Bun.write(
  MODULO,
  `// Generado por scripts/optimizar-imagenes.ts a partir de imagenes-originales/. No editar a mano:
// para cambiar o agregar una foto, ponla en imagenes-originales/ y vuelve a correr el script.
${importaciones.join("\n")}

export interface ImagenResponsiva {
  // Versión más grande (la que usa el lightbox o un fondo sin srcset).
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

${exportaciones.join("\n")}
`
);
