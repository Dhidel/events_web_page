import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import animacionEvento from "../assets/img/animacion-evento.jpg";
import { ACTS } from "../data/acts";

const SELECTABLE_ACTS = ACTS.filter((act) => act.price !== null);

export default function Cotizador() {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(SELECTABLE_ACTS.map((act) => [act.id, 0]))
  );

  const changeQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.min(20, Math.max(0, (prev[id] ?? 0) + delta)),
    }));
  };

  const { total, lines, waMessage } = useMemo(() => {
    let total = 0;
    const lines: { id: string; name: string; qty: number; subtotal: number }[] = [];
    for (const act of SELECTABLE_ACTS) {
      const qty = quantities[act.id] ?? 0;
      if (qty > 0 && act.price !== null) {
        const subtotal = qty * act.price;
        total += subtotal;
        lines.push({ id: act.id, name: act.name, qty, subtotal });
      }
    }
    const waMessage =
      "Hola! Use el cotizador del sitio y me interesa este estimado:\n" +
      lines.map((l) => `${l.qty}x ${l.name} (Q${l.subtotal.toLocaleString("es-GT")})`).join("\n") +
      `\nTotal estimado: Q${total.toLocaleString("es-GT")}`;
    return { total, lines, waMessage };
  }, [quantities]);

  const waHref = `https://wa.me/50230738716?text=${encodeURIComponent(waMessage)}`;

  return (
    <>
      <section className="page-banner">
        <div className="page-banner-bg" style={{ backgroundImage: `url('${animacionEvento}')` }} />
        <div className="wrap">
          <div className="breadcrumb">
            <Link to="/">Inicio</Link>
            <svg><use href="#i-arrow" /></svg>
            <span>Cotizador</span>
          </div>
          <span className="hero-badge"><svg><use href="#i-sparkle" /></svg>Estimado inmediato</span>
          <h1 style={{ marginTop: "16px" }}>Arma tu <span className="accent">espectáculo</span> y calcula el estimado</h1>
          <p>Elige cuántos personajes o actos quieres — el precio se calcula con nuestras tarifas reales por hora. El total final (traslado fuera de la capital, horas extra, montaje) siempre se confirma con un asesor por WhatsApp.</p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="contact-page-grid">
            <div>
              <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Selecciona tus personajes</span>
              <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px" }}>¿Qué quieres en tu evento?</h2>
              <p style={{ color: "var(--muted)", fontSize: "13.5px", marginBottom: "22px" }}>
                Precios reales por personaje, 1 hora de animación, dentro de la Ciudad Capital.
              </p>

              <div className="acts-selector">
                {SELECTABLE_ACTS.map((act) => (
                  <div className="act-row" key={act.id}>
                    <div className="act-row-info">
                      <h4>{act.name}</h4>
                      <span>
                        {act.includes} · 1 hora · <strong>Q{act.price!.toLocaleString("es-GT")}</strong> c/u
                      </span>
                    </div>
                    <div className="act-row-qty">
                      <button
                        type="button"
                        className="qty-btn qty-minus"
                        onClick={() => changeQty(act.id, -1)}
                      >
                        –
                      </button>
                      <input
                        type="number"
                        className="qty-input"
                        value={quantities[act.id] ?? 0}
                        min={0}
                        max={20}
                        readOnly
                      />
                      <button
                        type="button"
                        className="qty-btn qty-plus"
                        onClick={() => changeQty(act.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "16px", lineHeight: 1.6 }}>
                ¿Buscas Batucadas Temáticas (Brasileña, Dominicana, Chapina, Colombiana)? Tienen precio variable —{" "}
                <a
                  href="https://wa.me/50230738716?text=Hola!%20Quiero%20cotizar%20una%20Batucada%20Tematica"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--blue)", fontWeight: 700 }}
                >
                  cotízalas directo por WhatsApp
                </a>
                .
              </p>
            </div>

            <div>
              <div style={{ background: "var(--navy)", borderRadius: "20px", padding: "32px", color: "#fff", position: "sticky", top: "110px" }}>
                <span className="eyebrow" style={{ color: "var(--blue-light)" }}><svg><use href="#i-sparkle" /></svg>Tu estimado</span>
                <div style={{ fontSize: "42px", fontWeight: 900, margin: "10px 0 4px" }}>Q {total.toLocaleString("es-GT")}</div>
                <p style={{ color: "rgba(255,255,255,.5)", fontSize: "12.5px", marginBottom: "24px" }}>
                  Suma de personajes seleccionados — no incluye traslado, montaje ni horas extra
                </p>

                <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,.8)", maxHeight: "260px", overflowY: "auto" }}>
                  {lines.length === 0 ? (
                    <span style={{ color: "rgba(255,255,255,.4)" }}>Aún no has seleccionado personajes.</span>
                  ) : (
                    lines.map((l) => (
                      <div key={l.id} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{l.qty}x {l.name}</span>
                        <span>Q{l.subtotal.toLocaleString("es-GT")}</span>
                      </div>
                    ))
                  )}
                </div>

                <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "26px" }}>
                  <svg><use href="#i-whatsapp" /></svg>Confirmar este estimado por WhatsApp
                </a>

                <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,.4)", marginTop: "14px", lineHeight: 1.5 }}>
                  * Precio dentro de la Ciudad Capital. Traslado fuera de la capital, horas adicionales y montaje
                  especial se cotizan aparte con un asesor.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
