import { Link } from "react-router-dom";
import corporativo from "../assets/img/corporativo.jpg";
import quinceVivo from "../assets/img/quince-vivo.jpg";
import bodasColor from "../assets/img/bodas-anillos-color.jpg";
import navidad from "../assets/img/navidad.jpg";
import espectaculosRobots from "../assets/img/espectaculos-robots.jpg";
import { ACTS } from "../data/acts";

const DETAILS = [
  {
    id: "quinceaneras",
    img: quinceVivo,
    alt: "Quinceañera con personajes en vivo",
    icon: "i-crown",
    title: "Fiestas de Quinceañeras",
    text: "Los 15 años se viven una sola vez, y lo sabemos. Diseñamos la producción completa alrededor del tema que la quinceañera siempre imaginó — desde un cuento de princesas hasta un mundo de fantasía hecho realidad — con personajes en vivo que hacen que ella y sus invitados se sientan dentro de la historia.",
    includes: [
      "Personajes temáticos en vivo a la medida del concepto elegido",
      "Coordinación de coreografía de entrada y vals",
      "Animación y dinámicas para mantener la fiesta viva toda la noche",
      "Ambientación y montaje coordinado con el resto de proveedores",
    ],
    reverse: false,
  },
  {
    id: "bodas",
    img: bodasColor,
    alt: "Anillos de bodas",
    icon: "i-rings",
    title: "Bodas Espectaculares",
    text: "Tu boda no tiene por qué verse como todas las demás. Le damos ese toque de espectáculo a la recepción — desde una entrada memorable hasta momentos sorpresa durante la noche — sin quitarle nunca la elegancia que un día así merece.",
    includes: [
      "Producción de momentos sorpresa durante la recepción",
      "Animación elegante que no compite con la ceremonia, la complementa",
      "Coordinación con fotógrafo y planner para capturar cada momento",
      "Personajes o shows especiales si la pareja quiere algo fuera de lo tradicional",
    ],
    reverse: true,
  },
  {
    id: "corporativos",
    img: corporativo,
    alt: "Producción de gala para evento corporativo",
    icon: "i-briefcase",
    title: "Eventos Corporativos",
    text: "Activaciones de marca, fiestas de fin de año, lanzamientos de producto: ayudamos a que tu empresa deje una impresión que la gente sí recuerda, con una producción a la altura de la marca.",
    includes: [
      "Ambientación y montaje temático alineado a la identidad de marca",
      "Personajes y animación para activaciones o ferias comerciales",
      "Producción de fiestas de fin de año para colaboradores",
      "Coordinación logística con el equipo interno de la empresa",
    ],
    reverse: false,
  },
  {
    id: "navidad",
    img: navidad,
    alt: "Personajes navideños en centro comercial",
    icon: "i-gift",
    title: "Personajes Navideños",
    text: "Llevamos la magia de la Navidad directamente a centros comerciales, empresas y comunidades — personajes navideños en vivo, listos para tomarse fotos, animar y contagiar el espíritu de la temporada.",
    includes: [
      "Personajes navideños clásicos y temáticos a la medida",
      "Zancos, animación de piso y recorridos programados",
      "Disponibilidad para temporada alta (noviembre - diciembre)",
      "Paquetes por día, fin de semana o toda la temporada",
    ],
    reverse: true,
  },
  {
    id: "espectaculos",
    img: espectaculosRobots,
    alt: "Personajes de espectáculo y animación",
    icon: "i-masks",
    title: "Espectáculos y Animación",
    text: "Cuando el evento necesita ese factor sorpresa, aquí es donde entramos: shows temáticos, personajes originales, comparsas y animación en vivo diseñados específicamente para el tipo de público que vas a tener.",
    includes: [
      "Shows temáticos y comparsas diseñadas a la medida del evento",
      "Personajes originales o con licencia según disponibilidad",
      "Animación de pista y dinámicas para todas las edades",
      "Producción técnica: sonido, iluminación y montaje incluidos",
    ],
    reverse: false,
    withCatalogLink: true,
  },
];

function waLink(name: string, price: number | null) {
  const text =
    price !== null
      ? `Hola! Me interesa cotizar: ${name} (Q${price.toLocaleString("es-GT")} c/u). Quisiera más información.`
      : `Hola! Me interesa cotizar: ${name}`;
  return `https://wa.me/50230738716?text=${encodeURIComponent(text)}`;
}

export default function Servicios() {
  return (
    <>
      <section className="page-banner">
        <div className="page-banner-bg" style={{ backgroundImage: `url('${corporativo}')` }} />
        <div className="wrap">
          <div className="breadcrumb">
            <Link to="/">Inicio</Link>
            <svg><use href="#i-arrow" /></svg>
            <span>Servicios</span>
          </div>
          <span className="hero-badge"><svg><use href="#i-sparkle" /></svg>Todo lo que hacemos</span>
          <h1 style={{ marginTop: "16px" }}>
            Servicios pensados para que tu evento se sienta <span className="accent">único</span>
          </h1>
          <p>Desde una quinceañera de ensueño hasta la fiesta navideña de toda la empresa: así es como ponemos la magia en cada tipo de evento.</p>
        </div>
      </section>

      <section style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <p style={{ maxWidth: "680px", color: "var(--muted)", fontSize: "15.5px", lineHeight: 1.75 }}>
            Cada producción que realizamos es única y se diseña a la medida — no vendemos paquetes cerrados de
            catálogo. El precio final depende de la magnitud técnica, el tipo de show y el escenario elegido;
            escríbenos y te presentamos una propuesta económica personalizada.
          </p>
        </div>
      </section>

      <section style={{ paddingTop: "20px" }}>
        <div className="wrap">
          {DETAILS.map((d) => (
            <div className={d.reverse ? "service-detail reverse" : "service-detail"} id={d.id} key={d.id}>
              <div className="service-detail-media"><img src={d.img} alt={d.alt} /></div>
              <div className="service-detail-body">
                <div className="service-icon-lg"><svg><use href={`#${d.icon}`} /></svg></div>
                <h2>{d.title}</h2>
                <p>{d.text}</p>
                <ul className="service-includes">
                  {d.includes.map((inc) => (
                    <li key={inc}><svg><use href="#i-sparkle" /></svg>{inc}</li>
                  ))}
                </ul>
                <Link to="/contacto" className="btn btn-primary"><svg><use href="#i-wand" /></svg>Cotizar este servicio</Link>
                {d.withCatalogLink && (
                  <a href="#catalogo" className="btn btn-outline" style={{ marginLeft: "10px" }}>Ver catálogo con precios</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="gallery" id="catalogo">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow" style={{ justifyContent: "center" }}><svg><use href="#i-sparkle" /></svg>Catálogo con precios</span>
            <h2>Personajes y espectáculos, por hora</h2>
            <p style={{ color: "rgba(255,255,255,.6)", marginTop: "10px", maxWidth: "640px", marginLeft: "auto", marginRight: "auto" }}>
              Precios por personaje, 1 hora de animación, dentro de la Ciudad Capital. Fuera de la capital, cotiza el
              traslado por WhatsApp. Para armar el paquete completo de tu evento (varios personajes, más horas, otros
              servicios), usa nuestro{" "}
              <Link to="/cotizador" style={{ color: "var(--blue-light)", fontWeight: 700 }}>cotizador</Link> para un
              estimado inmediato, o escríbenos y te armamos una propuesta a la medida.
            </p>
          </div>
          <div className="acts-grid">
            {ACTS.map((act) => (
              <div className="act-card" key={act.id}>
                <h4>{act.name}</h4>
                {act.price !== null ? (
                  <span className="act-includes"><strong>Incluye:</strong> {act.includes}</span>
                ) : (
                  <>
                    <span className="act-includes">{act.includes}</span>
                    <span className="act-note">{act.note}</span>
                  </>
                )}
                <div className="act-meta">
                  {act.price !== null ? (
                    <>
                      <div className="act-price">
                        Q{act.price.toLocaleString("es-GT")}
                        <small>Costo por personaje</small>
                      </div>
                      <div className="act-duration">Duración<br />1 hora</div>
                    </>
                  ) : (
                    <div className="act-price" style={{ fontSize: "14px", color: "var(--muted)" }}>Precio variable</div>
                  )}
                </div>
                <a href={waLink(act.name, act.price)} target="_blank" rel="noreferrer" className="btn btn-primary">
                  <svg><use href="#i-whatsapp" /></svg>Cotizar
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="wrap">
          <h2>¿No encuentras exactamente lo que buscas?</h2>
          <p>Poseemos un portafolio exclusivo con una amplia variedad de conceptos artísticos. Cuéntanos tu proyecto y diseñamos la propuesta perfecta.</p>
          <div className="hero-ctas">
            <Link to="/contacto" className="btn btn-primary"><svg><use href="#i-wand" /></svg>Solicitar catálogo exclusivo</Link>
            <a href="https://wa.me/50230738716" className="btn btn-ghost"><svg><use href="#i-whatsapp" /></svg>Escribir por WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
