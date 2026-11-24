// Menús desplegables de la barra superior: agrupan botones y se cierran solos.
import { el } from '../ui/dom.js';

// Contenido de un botón de menú: nombre a la izquierda y atajo de teclado a la derecha.
export const etiqueta = (texto, atajo) => [
  el('span', { class: 'mi-texto' }, texto),
  el('span', { class: 'mi-atajo' }, atajo),
];
// Raya fina para separar grupos dentro de un menú.
export const separadorMenu = () => el('div', { class: 'menu-sep' });
// Texto chico de ayuda dentro de un menú.
export const notaMenu = (texto) => el('div', { class: 'menu-nota' }, texto);

// alElegir: se llama al apretar un botón del menú (sirve para devolver el foco a la hoja).
export function crearMenus({ alElegir } = {}) {
  const menus = [];   // { raiz, titulo, panel }

  function cerrarTodos(salvo = null) {
    for (const m of menus) {
      if (m === salvo) continue;
      m.panel.hidden = true;
      m.titulo.classList.remove('abierto');
    }
  }
  const hayAbierto = () => menus.some((m) => !m.panel.hidden);
  function abrir(m) {
    cerrarTodos(m);
    m.panel.hidden = false;
    m.titulo.classList.add('abierto');
  }

  // Crea un botón de grupo con su lista desplegable. Devuelve el elemento para ponerlo en la barra.
  function menu(texto, ...hijos) {
    const titulo = el('button', { type: 'button', class: 'btn menu-titulo' }, `${texto} ▾`);
    const panel = el('div', { class: 'menu-panel' }, ...hijos);
    panel.hidden = true;
    const raiz = el('div', { class: 'menu' }, titulo, panel);
    const m = { raiz, titulo, panel };
    titulo.addEventListener('click', () => {
      if (panel.hidden) abrir(m); else cerrarTodos();
    });
    // Con un menú abierto, pasar el mouse por otro título lo abre (como en AutoCAD).
    titulo.addEventListener('pointerenter', () => {
      if (hayAbierto() && panel.hidden) abrir(m);
    });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      cerrarTodos();
      if (alElegir) alElegir();
    });
    menus.push(m);
    return raiz;
  }

  // Marca el título del grupo cuando alguna de sus herramientas está en uso.
  function actualizar() {
    for (const m of menus) m.titulo.classList.toggle('activa', !!m.panel.querySelector('.activa'));
  }

  const alPulsar = (e) => {
    if (!menus.some((m) => m.raiz.contains(e.target))) cerrarTodos();
  };
  const alTecla = (e) => {
    if (e.key === 'Escape') cerrarTodos();
  };
  document.addEventListener('pointerdown', alPulsar);
  document.addEventListener('keydown', alTecla);

  function destruir() {
    document.removeEventListener('pointerdown', alPulsar);
    document.removeEventListener('keydown', alTecla);
  }

  return { menu, actualizar, cerrarTodos, destruir };
}