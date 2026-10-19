import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/img/logo.png";

const NAV_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/servicios", label: "Servicios" },
  { to: "/cotizador", label: "Cotizador" },
  { to: "/galeria", label: "Galería" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/contacto", label: "Contacto" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);

  // Esc cierra el menú móvil y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!open) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      botonMenu.current?.focus();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [open]);

  return (
    <header>
      <nav aria-label="Principal">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          {/* alt vacío: el nombre ya está escrito al lado y es el nombre del enlace. */}
          <img src={logo} alt="" />
          <span className="brand-name">SHOW COMPANY</span>
        </Link>
        {/* El botón va antes de los enlaces en el DOM: así, con el menú abierto, el siguiente Tab
            entra a los enlaces. No cambia cómo se ve: en escritorio el botón está oculto y en
            móvil el menú abierto es absoluto (fuera del flujo). */}
        <button
          ref={botonMenu}
          type="button"
          className="burger"
          aria-label="Menú"
          aria-expanded={open}
          aria-controls="menu-principal"
          onClick={() => setOpen((v) => !v)}
        >
          ≡
        </button>
        <div id="menu-principal" className={open ? "nav-links open" : "nav-links"}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/contacto" className="btn btn-primary mobile-only-cta" onClick={() => setOpen(false)}>
            <svg><use href="#i-phone" /></svg>Cotizar mi evento
          </Link>
        </div>
        <div className="nav-right">
          <Link to="/contacto" className="btn btn-primary">
            <svg><use href="#i-phone" /></svg>Cotizar mi evento
          </Link>
        </div>
      </nav>
    </header>
  );
}
