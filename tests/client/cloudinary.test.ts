import { describe, expect, test } from "bun:test";
import { srcSetCloudinary, urlCloudinary } from "../../client/src/lib/cloudinary";

// URLs de entrega de Cloudinary con transformaciones (client/src/lib/cloudinary.ts).

const FOTO = "https://res.cloudinary.com/demo/image/upload/v1790226004/show-company/gallery/abc.png";

describe("urlCloudinary", () => {
  test("agrega formato y calidad automáticos y limita el ancho sin recortar", () => {
    expect(urlCloudinary(FOTO, 800)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/v1790226004/show-company/gallery/abc.png"
    );
  });

  test("deja igual una URL que no es de Cloudinary", () => {
    expect(urlCloudinary("https://ejemplo.com/image/upload/foto.jpg", 800)).toBe("https://ejemplo.com/image/upload/foto.jpg");
    expect(urlCloudinary("blob:http://localhost/123", 800)).toBe("blob:http://localhost/123");
  });
});

describe("srcSetCloudinary", () => {
  test("una versión por ancho, con su descriptor w", () => {
    expect(srcSetCloudinary(FOTO, [400, 800])).toBe(
      `${urlCloudinary(FOTO, 400)} 400w, ${urlCloudinary(FOTO, 800)} 800w`
    );
  });

  test("undefined si la URL no es de Cloudinary (el <img> usa solo src)", () => {
    expect(srcSetCloudinary("https://ejemplo.com/foto.jpg")).toBeUndefined();
  });
});
