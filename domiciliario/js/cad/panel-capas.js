// Panel de capas: ver, bloquear, color, nombre, nueva, eliminar y pasar objetos elegidos a otra capa.
import { el } from '../ui/dom.js';
import { nuevoId, COLECCIONES_DE_PLANTA } from '../core/modelo.js';

const MAX_CAPAS = 50;
const MAX_NOMBRE = 40;
const CAPAS_BASICAS = new Set(['dibujo', 'muros', 'aberturas', 'locales', 'cotas', 'electrico', 'canalizaciones']);
const COLORES_NUEVOS = ['#4fc3f7', '#ffb74d', '#ba68c8', '#81c784', '#f06292', '#fff176', '#90a4ae', '#ff8a65'];
const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;

// Cuántos objetos usa cada capa: en total y en la planta activa.
function usoDeCapas(p) {
  const total = new Map();
  const activa = new Map();
  for (const col of COLECCIONES_DE_PLANTA) {
    for (const o of p[col] ?? []) {
      total.set(o.capa, (total.get(o.capa) || 0) + 1);
      if (o.planta === p.ui.plantaActiva) activa.set(o.capa, (activa.get(o.capa) || 0) + 1);
    }
  }
  return { total, activa };
}

// sesion: sesión abierta. mensaje(texto, tipo): escribe en la barra de comandos.
// alCambiar(): el editor se entera de que cambiaron las capas. asignar(idCapa): pasa lo elegido a esa capa.
export function crearPanelCapas({ sesion, mensaje, alCambiar, asignar }) {
  const proy = () => sesion.historial.proyecto;
  let visible = true;
  let firma = null;
  let filas = new Map();
  let elegidos = 0;
  let focoPendiente = null;

  const lista = el('div', { class: 'capas-lista' });
  const btnNueva = el('button', { type: 'button', class: 'btn', title: 'Crear una capa nueva' }, '+ Nueva');
  const selDestino = el('select', { title: 'Capa de destino' });
  const btnAsignar = el('button', { type: 'button', class: 'btn', title: 'Pasar los objetos elegidos a la capa de la lista' }, 'Aplicar');
  const lblElegidos = el('span', { class: 'capas-elegidos' });

  // Cambia propiedades de una capa. Ver, bloquear, color y nombre no entran en Ctrl+Z.
  function aplicar(id, cambios) {
    sesion.historial.cambiarSinHistorial((p) => {
      const c = p.capas.find((x) => x.id === id);
      if (c) Object.assign(c, cambios);
    });
    sincronizar();
    alCambiar();
  }

  function construir() {
    filas = new Map();
    const capas = proy().capas;
    const nodos = [];
    for (const c of capas) {
      const chkV = el('input', { type: 'checkbox', title: 'Visible u oculta' });
      const chkB = el('input', { type: 'checkbox', title: 'Bloqueada: se ve, pero no se puede elegir ni editar' });
      const color = el('input', { type: 'color', title: 'Color de la capa' });
      const nombre = el('input', { type: 'text', title: 'Nombre de la capa' });
      nombre.maxLength = MAX_NOMBRE;
      nombre.spellcheck = false;
      const cuenta = el('span', { class: 'capa-cuenta', title: 'Objetos en la planta activa' });
      const borrar = el('button', { type: 'button', class: 'capa-borrar' }, '×');
      const fila = el('div', { class: 'capa-fila' }, chkV, chkB, color, nombre, cuenta, borrar);

      chkV.addEventListener('change', () => aplicar(c.id, { visible: chkV.checked }));
      chkB.addEventListener('change', () => aplicar(c.id, { bloqueada: chkB.checked }));
      color.addEventListener('input', () => aplicar(c.id, { color: color.value }));
      nombre.addEventListener('change', () => {
        const actual = proy().capas.find((x) => x.id === c.id);
        if (!actual) return;
        const v = nombre.value.trim();
        if (!v) {
          mensaje('El nombre de la capa no puede quedar vacío.', 'error');
          nombre.value = actual.nombre;
          return;
        }
        if (proy().capas.some((x) => x.id !== c.id && x.nombre.toLowerCase() === v.toLowerCase())) {
          mensaje(`Ya existe una capa llamada "${v}".`, 'error');
          nombre.value = actual.nombre;
          return;
        }
        aplicar(c.id, { nombre: v });
      });
      // Lo que se escribe acá no debe llegar a los atajos de la hoja ni a Ctrl+Z del proyecto.
      nombre.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') nombre.blur();
        if (e.key === 'Escape') {
          const actual = proy().capas.find((x) => x.id === c.id);
          if (actual) nombre.value = actual.nombre;
          nombre.blur();
        }
      });
      borrar.addEventListener('click', () => {
        const uso = usoDeCapas(proy());
        if (CAPAS_BASICAS.has(c.id) || uso.total.get(c.id)) {
          mensaje('Esa capa no se puede eliminar.', 'error');
          return;
        }
        sesion.historial.cambiarSinHistorial((p) => {
          const i = p.capas.findIndex((x) => x.id === c.id);
          if (i >= 0) p.capas.splice(i, 1);
        });
        sincronizar();
        alCambiar();
      });

      filas.set(c.id, { fila, chkV, chkB, color, nombre, cuenta, borrar });
      nodos.push(fila);
    }
    lista.replaceChildren(...nodos);

    const previo = selDestino.value;
    selDestino.replaceChildren(...capas.map((c) => el('option', { value: c.id }, c.nombre)));
    if (capas.some((c) => c.id === previo)) selDestino.value = previo;
  }

  // Pone al día el panel con el proyecto. Solo se vuelve a armar si cambiaron las capas o sus nombres.
  function sincronizar() {
    const p = proy();
    const f = p.capas.map((c) => c.id + '|' + c.nombre).join('\n');
    if (f !== firma) { firma = f; construir(); }
    const uso = usoDeCapas(p);
    for (const c of p.capas) {
      const r = filas.get(c.id);
      if (!r) continue;
      r.chkV.checked = c.visible !== false;
      r.chkB.checked = c.bloqueada === true;
      if (COLOR_VALIDO.test(c.color) && r.color.value.toLowerCase() !== c.color.toLowerCase()) r.color.value = c.color;
      if (document.activeElement !== r.nombre) r.nombre.value = c.nombre;
      r.fila.classList.toggle('oculta', c.visible === false);
      r.fila.classList.toggle('bloqueada', c.bloqueada === true);
      r.cuenta.textContent = uso.activa.get(c.id) || '';
      const basica = CAPAS_BASICAS.has(c.id);
      const vacia = !uso.total.get(c.id);
      r.borrar.disabled = basica || !vacia;
      r.borrar.title = basica ? 'Las capas básicas no se pueden eliminar' : vacia ? 'Eliminar esta capa (está vacía)' : 'No se puede eliminar: tiene objetos';
    }
    if (focoPendiente && filas.has(focoPendiente)) {
      const r = filas.get(focoPendiente);
      focoPendiente = null;
      r.nombre.focus();
      r.nombre.select();
    }
  }

  btnNueva.addEventListener('click', () => {
    const p = proy();
    if (p.capas.length >= MAX_CAPAS) {
      mensaje(`Se llegó al máximo de ${MAX_CAPAS} capas.`, 'error');
      return;
    }
    const usados = new Set(p.capas.map((c) => c.nombre.toLowerCase()));
    let n = p.capas.length + 1;
    while (usados.has(`capa ${n}`)) n++;
    const id = nuevoId('c');
    const color = COLORES_NUEVOS[p.capas.length % COLORES_NUEVOS.length];
    focoPendiente = id;
    sesion.historial.cambiarSinHistorial((q) => {
      q.capas.push({ id, nombre: `Capa ${n}`, color, visible: true, bloqueada: false });
    });
    sincronizar();
    alCambiar();
  });

  btnAsignar.addEventListener('click', () => asignar(selDestino.value));

  const elemento = el('aside', { class: 'capas' },
    el('div', { class: 'capas-cab' }, el('strong', {}, 'Capas'), btnNueva),
    el('div', { class: 'capas-cols' },
      el('span', {}, 'Ver'), el('span', {}, 'Bloq'), el('span', {}, 'Color'),
      el('span', {}, 'Nombre'), el('span', { title: 'Objetos en la planta activa' }, 'N°'), el('span', {})),
    lista,
    el('div', { class: 'capas-pie' },
      lblElegidos,
      el('div', { class: 'capas-asignar' }, selDestino, btnAsignar)),
    el('p', { class: 'capas-nota' },
      'Línea se dibuja en "Dibujo" y Muro en "Muros". Para cambiar la capa de algo ya dibujado: elegilo, escogé la capa de destino y apretá Aplicar.'));

  function actualizarElegidos(n) {
    elegidos = n;
    lblElegidos.textContent = n ? `Elegidos: ${n}. Pasar a la capa:` : 'Sin objetos elegidos';
    selDestino.disabled = n === 0;
    btnAsignar.disabled = n === 0;
  }
  actualizarElegidos(0);

  return {
    elemento,
    actualizar: sincronizar,
    elegidos: actualizarElegidos,
    mostrarOcultar() {
      visible = !visible;
      elemento.style.display = visible ? '' : 'none';
      return visible;
    },
    get visible() { return visible; },
  };
}