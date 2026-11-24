import { el } from '../ui/dom.js';

// Barra de comandos estilo AutoCAD: historial de mensajes y línea de escritura.
export function crearBarraComandos({ alEnviar, alEscape, alDeshacer, alRehacer }) {
  const historial = el('div', { class: 'cmd-historial' });
  const etiqueta = el('span', { class: 'cmd-etiqueta' }, 'Comando:');
  const entrada = el('input', {
    type: 'text', class: 'cmd-entrada', autocomplete: 'off',
    placeholder: 'Escribí un comando (L, MU, AYUDA…) o coordenadas',
  });
  entrada.setAttribute('spellcheck', 'false');
  const elemento = el('div', { class: 'cmd' }, historial, el('div', { class: 'cmd-fila' }, etiqueta, entrada));

  function mensaje(texto, tipo = 'info') {
    historial.append(el('div', { class: 'cmd-linea ' + tipo }, texto));
    while (historial.childElementCount > 80) historial.firstElementChild.remove();
    historial.scrollTop = historial.scrollHeight;
  }

  entrada.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const ctrl = (e.ctrlKey || e.metaKey) && !e.getModifierState('AltGraph');
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = entrada.value;
      entrada.value = '';
      if (t.trim()) mensaje('› ' + t.trim(), 'eco');
      alEnviar(t);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (entrada.value) entrada.value = ''; else alEscape();
    } else if (ctrl && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      alDeshacer();
    } else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault();
      alRehacer();
    }
  });

  return {
    elemento,
    mensaje,
    indicar(texto) { etiqueta.textContent = texto; },
    escribir(caracter) { entrada.focus(); entrada.value += caracter; },
  };
}