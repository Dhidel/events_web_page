import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import animacionEvento from "../assets/img/animacion-evento.jpg";
import { GALLERY_ITEMS, type GalleryItem } from "../data/gallery";
import { fetchGallery } from "../lib/api";

const FILTERS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "quinceaneras", label: "Quinceaños" },
  { key: "bodas", label: "Bodas" },
  { key: "corporativo", label: "Corporativo" },
  { key: "navidad", label: "Navidad" },
  { key: "espectaculos", label: "Espectáculos" },
];

export default function Galeria() {
  const [filter, setFilter] = useState("todos");
  // Arranca con las fotos estáticas y, si la API responde, las reemplaza por las
  // que administra el panel. Si la API falla, se queda con las estáticas.
  const [items, setItems] = useState<GalleryItem[]>(GALLERY_ITEMS);

  useEffect(() => {
    fetchGallery()
      .then((data) => {
        if (data.length === 0) return;
        setItems(
          data.map((it) => ({
            id: it.id,
            img: it.imageUrl,
            alt: it.alt,
            category: it.category as GalleryItem["category"],
            categoryLabel: it.categoryLabel,
            label: it.label,
          }))
        );
      })
      .catch(() => {
        /* sin conexión con la API: se mantienen las fotos estáticas */
      });
  }, []);

  return (
    <>
      <section className="page-banner">
        <div className="page-banner-bg" style={{ backgroundImage: `url('${animacionEvento}')` }} />
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
                className={filter === f.key ? "filter-btn active" : "filter-btn"}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="gallery-grid gallery-grid-big">
            {items.map((item) => (
              <div
                className={filter === "todos" || item.category === filter ? "gallery-item" : "gallery-item hidden"}
                key={item.id}
              >
                <img src={item.img} alt={item.alt} />
                <span className="gallery-tag">{item.categoryLabel}</span>
                <span className="gallery-label">{item.label}</span>
                <span className="gallery-zoom"><svg><use href="#i-search" /></svg></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="wrap">
          <h2>¿Quieres que tu evento se vea así?</h2>
          <p>Cuéntanos tu proyecto y te presentamos una propuesta a la altura de tu evento.</p>
          <div className="hero-ctas">
            <Link to="/contacto" className="btn btn-primary"><svg><use href="#i-wand" /></svg>Solicitar catálogo exclusivo</Link>
            <a href="https://wa.me/50230738716" className="btn btn-ghost"><svg><use href="#i-whatsapp" /></svg>Escribir por WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
