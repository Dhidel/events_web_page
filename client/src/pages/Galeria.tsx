import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { animacionEvento } from "../assets/imagenes";
import { FondoBanner } from "../components/Foto";
import { fetchGallery, type GalleryImage } from "../lib/api";
import { srcSetCloudinary, urlCloudinary } from "../lib/cloudinary";
import Lightbox from "../components/Lightbox";
import { generarEnlaceWhatsAppDirecto } from "../utils/whatsapp";

// Ancho de cada foto en .gallery-grid-big (3 columnas de 367px, 2 desde 1000px, 1 desde 680px).
// Con object-fit: cover una foto horizontal 16:9 en una casilla de 230px de alto ocupa ~410px:
// por eso 420px y no 367px, para que no se vea borrosa.
const SIZES_GALERIA = "(max-width: 680px) calc(100vw - 48px), (max-width: 1000px) calc(50vw - 32px), 420px";
const ANCHOS_LIGHTBOX = [800, 1200, 1600, 2000];

const FILTERS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "quinceaneras", label: "Quinceaños" },
  { key: "bodas", label: "Bodas" },
  { key: "corporativo", label: "Corporativo" },
  { key: "navidad", label: "Navidad" },
  { key: "espectaculos", label: "Espectáculos" },
];

function GalleryPhoto({ item, hidden, onAbrir }: { item: GalleryImage; hidden: boolean; onAbrir: () => void }) {
  const [estado, setEstado] = useState<"cargando" | "lista" | "error">("cargando");

  const classes = ["gallery-item"];
  if (estado === "cargando") classes.push("is-loading");
  if (hidden) classes.push("hidden");

  return (
    <div className={classes.join(" ")}>
      {estado === "error" ? (
        <div className="gallery-fallback" role="img" aria-label={item.alt}>
          <svg><use href="#i-masks" /></svg>
          <span>{item.alt}</span>
        </div>
      ) : (
        <img
          className={estado === "lista" ? "gallery-photo is-loaded" : "gallery-photo"}
          src={urlCloudinary(item.imageUrl, 800)}
          srcSet={srcSetCloudinary(item.imageUrl)}
          sizes={SIZES_GALERIA}
          alt={item.alt}
          loading="lazy"
          onLoad={() => setEstado("lista")}
          onError={() => setEstado("error")}
        />
      )}
      <span className="gallery-tag">{item.categoryLabel}</span>
      <span className="gallery-label">{item.label}</span>
      <span className="gallery-zoom"><svg><use href="#i-search" /></svg></span>
      {/* Botón transparente sobre toda la foto: abre el lightbox con clic, Enter o Espacio. */}
      <button type="button" className="gallery-abrir" aria-label={`Ver foto: ${item.alt}`} onClick={onAbrir} />
    </div>
  );
}

export default function Galeria() {
  const [filter, setFilter] = useState("todos");
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Índice (dentro de las fotos del filtro activo) de la foto abierta en el lightbox.
  const [abierta, setAbierta] = useState<number | null>(null);
  const visibles = useMemo(() => items.filter((item) => filter === "todos" || item.category === filter), [items, filter]);
  const cerrar = useCallback(() => setAbierta(null), []);

  useEffect(() => {
    fetchGallery()
      .then((data) => {
        setItems(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <>
      <section className="page-banner">
        <FondoBanner imagen={animacionEvento} />
        <div className="wrap">
          <div className="breadcrumb">
            <Link to="/">Inicio</Link>
            <svg><use href="#i-arrow" /></svg>
            <span>Galería</span>
          </div>
          <span className="hero-badge"><svg><use href="#i-sparkle" /></svg>Portafolio exclusivo</span>
          <h1 style={{ marginTop: "16px" }}>Así se ve la <span className="accent">excelencia artística</span> en escena</h1>
          <p>Cada foto de esta galería es de un evento real de Show Company. Filtra por categoría y descubre el nivel de producción que respalda cada montaje.</p>
        </div>
      </section>

      <section className="gallery" style={{ paddingTop: "56px" }}>
        <div className="wrap">
          <div className="filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? "filter-btn active" : "filter-btn"}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {status === "loading" && <p className="gallery-empty">Cargando galería…</p>}
          {status === "error" && (
            <p className="gallery-empty">No se pudo cargar la galería. Intenta de nuevo más tarde.</p>
          )}
          {status === "ready" && items.length === 0 && (
            <p className="gallery-empty">Todavía no hay fotos en la galería.</p>
          )}

          {status === "ready" && items.length > 0 && (
            <div className="gallery-grid gallery-grid-big">
              {items.map((item) => (
                <GalleryPhoto
                  key={item.id}
                  item={item}
                  hidden={filter !== "todos" && item.category !== filter}
                  onAbrir={() => setAbierta(visibles.indexOf(item))}
                />
              ))}
            </div>
          )}
          {abierta !== null && (
            <Lightbox
              fotos={visibles.map((item) => ({
                src: urlCloudinary(item.imageUrl, 2000),
                srcSet: srcSetCloudinary(item.imageUrl, ANCHOS_LIGHTBOX),
                alt: item.alt,
                label: item.label,
                tag: item.categoryLabel,
              }))}
              indice={abierta}
              onCambiar={setAbierta}
              onCerrar={cerrar}
            />
          )}
        </div>
      </section>

      <section className="cta-banner">
        <div className="wrap">
          <h2>¿Quieres que tu evento se vea así?</h2>
          <p>Cuéntanos tu proyecto y te presentamos una propuesta a la altura de tu evento.</p>
          <div className="hero-ctas">
            <Link to="/contacto" className="btn btn-primary"><svg><use href="#i-wand" /></svg>Solicitar catálogo exclusivo</Link>
            <a href={generarEnlaceWhatsAppDirecto()} target="_blank" rel="noreferrer" className="btn btn-ghost"><svg><use href="#i-whatsapp" /></svg>Escribir por WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
