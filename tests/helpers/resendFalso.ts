// Reemplazo del SDK de Resend para las pruebas (se instala en tests/setup.ts con mock.module).
// Ninguna prueba manda correos reales; cada una puede forzar cómo responde Resend.

export type ModoResend =
  | { tipo: "ok" }
  | { tipo: "error"; error: { name: string; message: string; statusCode: number | null } } // Resend responde con error
  | { tipo: "lanza"; error: Error } // falla de red u otra excepción
  | { tipo: "colgado" }; // nunca responde

export const resendFalso = {
  modo: { tipo: "ok" } as ModoResend,
  enviados: [] as { from: string; to: string[]; subject: string; html: string }[],
  reiniciar() {
    this.modo = { tipo: "ok" };
    this.enviados = [];
  },
};

export class ResendFalso {
  constructor(_key?: string) {}

  emails = {
    send: async (payload: { from: string; to: string[]; subject: string; html: string }) => {
      const modo = resendFalso.modo;
      if (modo.tipo === "lanza") throw modo.error;
      if (modo.tipo === "colgado") return new Promise<never>(() => {});
      if (modo.tipo === "error") return { data: null, error: modo.error, headers: null };
      resendFalso.enviados.push(payload);
      return { data: { id: `correo-falso-${resendFalso.enviados.length}` }, error: null, headers: null };
    },
  };
}
