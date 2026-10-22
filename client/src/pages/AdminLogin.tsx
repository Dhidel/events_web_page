import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/logo.png";
import { useTitulo } from "../lib/useTitulo";

const API_BASE = import.meta.env.DEV ? "http://localhost:3000" : "";

export default function AdminLogin() {
  useTitulo("Iniciar sesión · Panel administrativo");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("adminToken", data.token);
        navigate("/admin/dashboard");
        return;
      }

      setError(data.error ?? "Ocurrió un error. Intenta de nuevo.");
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <img src={logo} alt="Show Company" className="admin-login-logo" />
        <span className="eyebrow" style={{ justifyContent: "center" }}>
          Panel administrativo
        </span>
        <h1>Iniciar sesión</h1>
        <p>Acceso exclusivo para el equipo de Show Company.</p>

        <form onSubmit={handleSubmit}>
          {/* Labels ocultos a la vista (.sr-only) para no cambiar el diseño; autoComplete deja que el
              gestor de contraseñas reconozca los campos. */}
          <label htmlFor="admin-correo" className="sr-only">Correo electrónico</label>
          <input
            id="admin-correo"
            type="email"
            placeholder="Correo electrónico"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-login-error" : undefined}
            required
          />
          <label htmlFor="admin-contrasena" className="sr-only">Contraseña</label>
          <input
            id="admin-contrasena"
            type="password"
            placeholder="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-login-error" : undefined}
            required
          />

          {/* Siempre en el DOM: role="alert" solo se anuncia de forma fiable si la región ya existía. */}
          <p id="admin-login-error" className="admin-login-error" role="alert">{error}</p>

          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco y el teclado vuelve al
              inicio de la página. El doble envío lo frena el if (loading) de handleSubmit. */}
          <button type="submit" className="btn btn-primary" aria-disabled={loading || undefined}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
