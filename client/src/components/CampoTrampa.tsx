// Honeypot anti-spam ([14.3]). Una persona nunca lo ve ni lo llena; muchos bots llenan todos
// los campos que encuentran. Si llega con texto, el servidor responde "éxito" pero descarta
// el envío.
//
// No se usa display:none (algunos bots saltan esos campos): se saca de la pantalla con CSS
// (.campo-trampa). aria-hidden lo oculta a los lectores de pantalla, tabIndex={-1} evita que
// se llegue con Tab y autoComplete="off" que el navegador lo autocomplete.
//
// Accesibilidad ([12.3]–[12.5]): este campo está oculto A PROPÓSITO y es la única excepción a
// la regla de "todo campo con label visible y alcanzable con teclado". No hay que:
//   - darle un label visible ni sacarlo de .campo-trampa (una persona lo llenaría y su envío
//     se descartaría en silencio);
//   - quitarle aria-hidden ni el tabIndex={-1} (un lector de pantalla o el Tab lo encontrarían);
//   - contarlo en auditorías como "input sin label": axe lo ignora por estar en aria-hidden.
// El <label> de adentro existe solo para los bots que buscan el nombre del campo.
export default function CampoTrampa({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="campo-trampa" aria-hidden="true">
      <label>
        Sitio web (no completes este campo)
        <input
          type="text"
          name="sitioWeb"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
