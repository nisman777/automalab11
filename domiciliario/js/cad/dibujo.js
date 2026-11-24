import { nuevoId } from '../core/modelo.js';
import { arcoPorTresPuntos, arcoCentroInicioFin, barrido, fmt, textoMedida } from './geometria.js';


// modo 'cadena': cada tramo es un objeto aparte (línea, muro).
// modo 'polilinea': todos los tramos forman un solo objeto.
// modo 'fijo': una cantidad fija de puntos (pasos) y se crea la figura.
export const HERRAMIENTAS = {
  linea: { nombre: 'Línea', mayus: 'LÍNEA', col: 'lineas', capa: 'dibujo', prefijo: 'l', modo: 'cadena' },
  muro: { nombre: 'Muro', mayus: 'MURO', col: 'muros', capa: 'muros', prefijo: 'm', modo: 'cadena' },
  polilinea: { nombre: 'Polilínea', mayus: 'POLILÍNEA', col: 'polilineas', capa: 'dibujo', prefijo: 'pl', modo: 'polilinea' },
  rectangulo: {
    nombre: 'Rectángulo', mayus: 'RECTÁNGULO', col: 'polilineas', capa: 'dibujo', prefijo: 'pl', modo: 'fijo',
    pasos: ['Primera esquina (clic o x,y)', 'Esquina opuesta (clic, x,y o @ancho,alto)'],
  },
  circulo: {
    nombre: 'Círculo', mayus: 'CÍRCULO', col: 'circulos', capa: 'dibujo', prefijo: 'c', modo: 'fijo',
    pasos: ['Centro (clic o x,y)', 'Radio (clic, o escribí el radio)'],
  },
  arco: {
    nombre: 'Arco', mayus: 'ARCO', col: 'arcos', capa: 'dibujo', prefijo: 'a', modo: 'fijo',
    pasos: ['Punto inicial (clic o x,y)', 'Segundo punto, por donde pasa el arco', 'Punto final'],
  },
  arcoc: {
    nombre: 'Arco por centro', mayus: 'ARCO CENTRO', col: 'arcos', capa: 'dibujo', prefijo: 'a', modo: 'fijo',
    pasos: ['Centro del arco', 'Punto inicial (define el radio)', 'Punto final (el arco va en sentido antihorario)'],
  },
};


const NUM = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const RE_NUM = new RegExp('^' + NUM + '$');
const RE_POLAR = new RegExp('^@(' + NUM + ')<(' + NUM + ')$');
const limpiar = (n) => Math.round(n * 1e6) / 1e6;
const copia = (q) => ({ x: q.x, y: q.y });


// Interpreta lo escrito en la barra de comandos como un punto.
//   x,y          coordenadas absolutas
//   @dx,dy       relativo al último punto
//   @largo<áng   polar relativo (ángulo en grados, 0 = Este, antihorario)
//   largo        distancia en la dirección actual del cursor
// Los decimales llevan punto.
export function interpretarPunto(texto, base, cursor) {
  const t = texto.trim().replace(/\s+/g, '');
  let m = RE_POLAR.exec(t);
  if (m) {
    if (!base) return { error: 'No hay un punto anterior desde donde medir.' };
    const L = Number(m[1]);
    const a = (Number(m[2]) * Math.PI) / 180;
    return { punto: { x: limpiar(base.x + L * Math.cos(a)), y: limpiar(base.y + L * Math.sin(a)) } };
  }
  const rel = t.startsWith('@');
  const partes = (rel ? t.slice(1) : t).split(/[,;]/);
  if (partes.length === 2 && partes.every((s) => RE_NUM.test(s))) {
    const x = Number(partes[0]), y = Number(partes[1]);
    if (rel) {
      if (!base) return { error: 'No hay un punto anterior desde donde medir.' };
      return { punto: { x: limpiar(base.x + x), y: limpiar(base.y + y) } };
    }
    return { punto: { x: limpiar(x), y: limpiar(y) } };
  }
  if (!rel && partes.length === 1 && RE_NUM.test(t)) {
    if (!base) return { error: 'Primero indicá el punto inicial.' };
    if (!cursor) return { error: 'Mové el cursor sobre la hoja para indicar la dirección.' };
    const dx = cursor.x - base.x, dy = cursor.y - base.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return { error: 'Mové el cursor para indicar la dirección.' };
    const L = Number(t);
    return { punto: { x: limpiar(base.x + (dx / d) * L), y: limpiar(base.y + (dy / d) * L) } };
  }
  return { error: `No entiendo "${texto.trim()}". Probá: x,y · @dx,dy · @largo<ángulo · un largo.` };
}


const INVALIDO = {
  rectangulo: 'El rectángulo necesita ancho y alto distintos de cero.',
  circulo: 'El radio no puede ser cero.',
  arco: 'Los tres puntos están alineados o repetidos: no se puede trazar el arco.',
  arcoc: 'No se puede trazar el arco: el radio es cero o el punto final queda en la misma dirección que el inicial.',
};


// Figura que resulta de una lista de puntos: { col, datos } o null si todavía no alcanza o no es válida.
// Sirve tanto para crear el objeto como para la vista previa.
export function formaDe(clave, pts) {
  switch (clave) {
    case 'rectangulo': {
      if (pts.length < 2) return null;
      const [a, b] = pts;
      if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) return null;
      return {
        col: 'polilineas',
        datos: { puntos: [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }], cerrada: true },
      };
    }
    case 'circulo': {
      if (pts.length < 2) return null;
      const r = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (r < 1e-6) return null;
      return { col: 'circulos', datos: { cx: pts[0].x, cy: pts[0].y, r: limpiar(r) } };
    }
    case 'arco': {
      if (pts.length < 3) return null;
      const a = arcoPorTresPuntos(pts[0], pts[1], pts[2]);
      return a ? { col: 'arcos', datos: a } : null;
    }
    case 'arcoc': {
      if (pts.length < 3) return null;
      const a = arcoCentroInicioFin(pts[0], pts[1], pts[2]);
      return a ? { col: 'arcos', datos: a } : null;
    }
    default: return null;
  }
}


// Estado de la herramienta activa y de los puntos que se van marcando.
export function crearDibujo({ sesion, mensaje, indicar, alCambiar, leerEspesor }) {
  let herramienta = null;
  let puntos = [];        // puntos marcados de la figura actual
  let planta = null;      // planta donde empezó la figura
  const proy = () => sesion.historial.proyecto;


  function texto() {
    if (!herramienta) return 'Comando:';
    const h = HERRAMIENTAS[herramienta];
    if (h.modo === 'cadena') {
      if (!puntos.length) return h.mayus + ' · Primer punto (clic, o x,y):';
      return h.mayus + ' · Siguiente punto (clic, x,y, @dx,dy, largo · C cierra · Enter termina):';
    }
    if (h.modo === 'polilinea') {
      if (!puntos.length) return h.mayus + ' · Primer punto (clic, o x,y):';
      return h.mayus + ' · Siguiente punto (clic, x,y, @dx,dy, largo · C cierra · U quita el último · Enter termina):';
    }
    return h.mayus + ' · ' + h.pasos[puntos.length] + ':';
  }
  const avisarEstado = () => { indicar(texto()); alCambiar(); };
  const reiniciar = () => { puntos = []; planta = null; };


  // Capa donde va lo que se dibuja con esta herramienta (avisa si está oculta o bloqueada).
  function capaDestino(h) {
    const capa = proy().capas.find((c) => c.id === h.capa) ?? proy().capas[0];
    if (capa.visible === false || capa.bloqueada) {
      mensaje(`La capa "${capa.nombre}" está oculta o bloqueada. Activala para dibujar.`, 'error');
      return null;
    }
    return capa;
  }


  function agregar(h, forma, capa) {
    const obj = { id: nuevoId(h.prefijo), planta: proy().ui.plantaActiva, capa: capa.id, ...forma.datos };
    try {
      sesion.historial.transaccion('Dibujar ' + h.nombre.toLowerCase(), (t) => t.agregar(forma.col, obj));
      return true;
    } catch (e) {
      mensaje('No se pudo dibujar: ' + (e.message || e), 'error');
      return false;
    }
  }


  // Crea la polilínea con los puntos marcados (hace falta que haya al menos 2).
  function terminarPolilinea(cerrada) {
    const h = HERRAMIENTAS.polilinea;
    if (puntos.length < 2) return;
    const capa = capaDestino(h);
    if (!capa) return;
    agregar(h, { col: 'polilineas', datos: { puntos: puntos.map(copia), cerrada } }, capa);
  }


  function elegir(clave) {
    if (!HERRAMIENTAS[clave]) return;
    if (herramienta && HERRAMIENTAS[herramienta].modo === 'polilinea' && puntos.length >= 2) terminarPolilinea(false);
    reiniciar();
    herramienta = clave;
    avisarEstado();
  }


  // Primer Esc/Enter/clic derecho: termina la figura (la polilínea se conserva). El siguiente: sale de la herramienta.
  function cancelar() {
    if (puntos.length) {
      if (HERRAMIENTAS[herramienta].modo === 'polilinea') terminarPolilinea(false);
      reiniciar();
      avisarEstado();
      return true;
    }
    if (herramienta) { herramienta = null; avisarEstado(); return true; }
    return false;
  }


  function fijar(pt) {
    if (!herramienta) return;
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y) || Math.abs(pt.x) > 1e5 || Math.abs(pt.y) > 1e5) {
      mensaje('Coordenada fuera de rango.', 'error');
      return;
    }
    const h = HERRAMIENTAS[herramienta];
    const activa = proy().ui.plantaActiva;
    const capa = capaDestino(h);
    if (!capa) return;
    if (!puntos.length) {
      puntos = [copia(pt)];
      planta = activa;
      avisarEstado();
      return;
    }
    const a = puntos[puntos.length - 1];
    if (Math.hypot(pt.x - a.x, pt.y - a.y) < 1e-6) {
      mensaje('El punto coincide con el anterior.', 'error');
      return;
    }
    if (h.modo === 'cadena') {
      const datos = { x1: a.x, y1: a.y, x2: pt.x, y2: pt.y };
      if (herramienta === 'muro') datos.espesor = leerEspesor();
      if (!agregar(h, { col: h.col, datos }, capa)) return;
      puntos.push(copia(pt));
      avisarEstado();
      return;
    }
    if (h.modo === 'polilinea') {
      puntos.push(copia(pt));
      avisarEstado();
      return;
    }
    // modo fijo
    const nuevos = [...puntos, copia(pt)];
    if (nuevos.length < h.pasos.length) {
      puntos = nuevos;
      avisarEstado();
      return;
    }
    const forma = formaDe(herramienta, nuevos);
    if (!forma) {
      mensaje(INVALIDO[herramienta], 'error');
      return;
    }
    if (!agregar(h, forma, capa)) return;
    reiniciar();
    avisarEstado();
  }


  function cerrar() {
    if (!herramienta) return;
    const h = HERRAMIENTAS[herramienta];
    if (h.modo === 'fijo') {
      mensaje('C (cerrar) sirve en línea, muro y polilínea.', 'error');
      return;
    }
    if (puntos.length < 3) {
      mensaje('Se necesitan al menos 2 tramos (3 puntos) para poder cerrar.', 'error');
      return;
    }
    if (h.modo === 'polilinea') {
      terminarPolilinea(true);
    } else {
      fijar({ x: puntos[0].x, y: puntos[0].y });
    }
    reiniciar();
    avisarEstado();
  }


  // Comando U dentro de una figura: vuelve al punto anterior.
  function retroceder() {
    if (!puntos.length) return false;
    const h = HERRAMIENTAS[herramienta];
    if (h.modo === 'cadena' && puntos.length > 1 && !sesion.historial.deshacer()) return false;
    puntos.pop();
    if (!puntos.length) planta = null;
    avisarEstado();
    return true;
  }


  // Si cambió la planta activa a mitad de una figura, se descarta.
  function revisar() {
    if (puntos.length && planta !== proy().ui.plantaActiva) {
      reiniciar();
      avisarEstado();
    }
  }


  // Lo que se muestra mientras se dibuja, con el cursor donde está.
  // Devuelve { forma: {col, datos} | null, guias: [{a, b}], texto }.
  function previa(cursor) {
    const res = { forma: null, guias: [], texto: null };
    if (!herramienta || !cursor || !puntos.length) return res;
    const h = HERRAMIENTAS[herramienta];
    const c = { x: cursor.x, y: cursor.y };
    const ult = puntos[puntos.length - 1];
    const lejos = Math.hypot(c.x - ult.x, c.y - ult.y) > 1e-6;
    if (h.modo === 'cadena') {
      if (!lejos) return res;
      const datos = { x1: ult.x, y1: ult.y, x2: c.x, y2: c.y };
      if (herramienta === 'muro') datos.espesor = leerEspesor();
      res.forma = { col: h.col, datos };
      res.texto = textoMedida(ult, c);
      return res;
    }
    if (h.modo === 'polilinea') {
      const lista = lejos ? [...puntos, c] : puntos;
      if (lista.length >= 2) res.forma = { col: 'polilineas', datos: { puntos: lista, cerrada: false } };
      if (lejos) res.texto = textoMedida(ult, c);
      return res;
    }
    const f = formaDe(herramienta, [...puntos, c]);
    res.forma = f;
    if (herramienta === 'rectangulo') {
      if (f) res.texto = `${fmt(Math.abs(c.x - puntos[0].x), 2)} × ${fmt(Math.abs(c.y - puntos[0].y), 2)} m`;
    } else if (herramienta === 'circulo') {
      res.guias.push({ a: puntos[0], b: c });
      res.texto = `R = ${fmt(Math.hypot(c.x - puntos[0].x, c.y - puntos[0].y), 2)} m`;
    } else if (herramienta === 'arco') {
      if (puntos.length === 1) res.guias.push({ a: puntos[0], b: c });
      else if (!f) res.guias.push({ a: puntos[0], b: puntos[1] }, { a: puntos[1], b: c });
    } else if (herramienta === 'arcoc') {
      res.guias.push({ a: puntos[0], b: puntos[1] ?? c });
      if (puntos.length === 2) res.guias.push({ a: puntos[0], b: c });
      if (puntos.length === 1) res.texto = `R = ${fmt(Math.hypot(c.x - puntos[0].x, c.y - puntos[0].y), 2)} m`;
    }
    if (f && f.col === 'arcos') {
      res.texto = `R = ${fmt(f.datos.r, 2)} m  ·  ${fmt(barrido(f.datos.a1, f.datos.a2), 1)}°`;
    }
    return res;
  }


  return {
    elegir, cancelar, fijar, cerrar, retroceder, revisar, texto, previa,
    get herramienta() { return herramienta; },
    get base() { return puntos.length ? puntos[puntos.length - 1] : null; },
    get enCadena() { return puntos.length > 0; },
  };
}
