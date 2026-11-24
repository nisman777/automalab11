// Tiradores: los cuadraditos de los objetos elegidos y cómo cambia cada figura al moverlos.
// Solo calcula; no dibuja ni toca el proyecto.
import { COLECCIONES_EDITABLES } from './seleccion.js';
import { RAD, barrido } from './geometria.js';

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const grados360 = (a) => {
  const n = r6(((a % 360) + 360) % 360);
  return n >= 360 ? 0 : n;
};
const fmt = (n, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

const MAX_OBJETOS = 100;    // con más objetos elegidos no se muestran tiradores
const MAX_TIRADORES = 1000;
const R_MAX = 1e5;

// Tiradores de un objeto: [{ idx, tipo, x, y }]
// tipo: extremo, medio, vertice, centro, radio (cambia el radio), angulo (extremo de arco)
export function tiradoresDe(col, o) {
  switch (col) {
    case 'polilineas':
      return o.puntos.map((q, i) => ({ idx: i, tipo: 'vertice', x: q.x, y: q.y }));
    case 'circulos':
      return [
        { idx: 0, tipo: 'centro', x: o.cx, y: o.cy },
        { idx: 1, tipo: 'radio', x: o.cx + o.r, y: o.cy },
        { idx: 2, tipo: 'radio', x: o.cx, y: o.cy + o.r },
        { idx: 3, tipo: 'radio', x: o.cx - o.r, y: o.cy },
        { idx: 4, tipo: 'radio', x: o.cx, y: o.cy - o.r },
      ];
    case 'arcos': {
      const en = (a) => ({ x: o.cx + o.r * Math.cos(a * RAD), y: o.cy + o.r * Math.sin(a * RAD) });
      const ini = en(o.a1);
      const fin = en(o.a2);
      const med = en(o.a1 + barrido(o.a1, o.a2) / 2);
      return [
        { idx: 0, tipo: 'centro', x: o.cx, y: o.cy },
        { idx: 1, tipo: 'angulo', x: ini.x, y: ini.y },
        { idx: 2, tipo: 'angulo', x: fin.x, y: fin.y },
        { idx: 3, tipo: 'radio', x: med.x, y: med.y },
      ];
    }
    default:   // líneas y muros
      return [
        { idx: 0, tipo: 'extremo', x: o.x1, y: o.y1 },
        { idx: 1, tipo: 'extremo', x: o.x2, y: o.y2 },
        { idx: 2, tipo: 'medio', x: (o.x1 + o.x2) / 2, y: (o.y1 + o.y2) / 2 },
      ];
  }
}

// Todos los tiradores de los objetos elegidos (claves "coleccion:id") de la planta activa.
// Cada uno: { col, id, k, idx, tipo, x, y }
export function todosLosTiradores(p, claves) {
  if (!claves || claves.size === 0 || claves.size > MAX_OBJETOS) return [];
  const res = [];
  for (const col of COLECCIONES_EDITABLES) {
    for (const o of p[col]) {
      if (o.planta !== p.ui.plantaActiva) continue;
      const k = col + ':' + o.id;
      if (!claves.has(k)) continue;
      for (const g of tiradoresDe(col, o)) res.push({ ...g, col, id: o.id, k });
      if (res.length > MAX_TIRADORES) return [];
    }
  }
  return res;
}

// Tirador más cercano al punto (en píxeles), o null si no hay ninguno a tolerancia.
export function tiradorEn(p, claves, vista, px, py, tolerancia = 8) {
  let mejor = null;
  let dMejor = Infinity;
  for (const g of todosLosTiradores(p, claves)) {
    const s = vista.aPantalla(g.x, g.y);
    const d = Math.hypot(s.x - px, s.y - py);
    if (d <= tolerancia && d < dMejor) {
      mejor = g;
      dMejor = d;
    }
  }
  return mejor;
}

function conRadio(o, pt) {
  const r = Math.hypot(pt.x - o.cx, pt.y - o.cy);
  if (!(r >= 0.001 && r < R_MAX)) return { error: 'El radio tiene que estar entre 0,001 y 100.000 m.' };
  return { campos: { r: r6(r) } };
}

// Qué campos cambian al llevar el tirador g al punto pt.
// Devuelve { campos } o { error }.
export function camposPorTirador(col, o, g, pt) {
  const dx = pt.x - g.x;
  const dy = pt.y - g.y;
  switch (col) {
    case 'polilineas':
      return {
        campos: {
          puntos: o.puntos.map((q, i) => (i === g.idx ? { x: r6(pt.x), y: r6(pt.y) } : { x: q.x, y: q.y })),
        },
      };
    case 'circulos':
      if (g.tipo === 'centro') return { campos: { cx: r6(o.cx + dx), cy: r6(o.cy + dy) } };
      return conRadio(o, pt);
    case 'arcos': {
      if (g.tipo === 'centro') return { campos: { cx: r6(o.cx + dx), cy: r6(o.cy + dy) } };
      if (g.tipo === 'radio') return conRadio(o, pt);
      if (Math.hypot(pt.x - o.cx, pt.y - o.cy) < 1e-9) return { error: 'El punto coincide con el centro del arco.' };
      const a = grados360(Math.atan2(pt.y - o.cy, pt.x - o.cx) / RAD);
      const otro = g.idx === 1 ? o.a2 : o.a1;
      const dif = Math.abs((((a - otro) % 360) + 360) % 360);
      if (dif < 1e-6 || Math.abs(dif - 360) < 1e-6) return { error: 'Los dos extremos del arco no pueden quedar en el mismo ángulo.' };
      return { campos: g.idx === 1 ? { a1: a } : { a2: a } };
    }
    default: {   // líneas y muros
      if (g.idx === 2) {
        return { campos: { x1: r6(o.x1 + dx), y1: r6(o.y1 + dy), x2: r6(o.x2 + dx), y2: r6(o.y2 + dy) } };
      }
      const nuevo = g.idx === 0
        ? { x1: r6(pt.x), y1: r6(pt.y), x2: o.x2, y2: o.y2 }
        : { x1: o.x1, y1: o.y1, x2: r6(pt.x), y2: r6(pt.y) };
      if (Math.hypot(nuevo.x2 - nuevo.x1, nuevo.y2 - nuevo.y1) < 1e-6) return { error: 'La figura quedaría de largo cero.' };
      return { campos: g.idx === 0 ? { x1: nuevo.x1, y1: nuevo.y1 } : { x2: nuevo.x2, y2: nuevo.y2 } };
    }
  }
}

// Medida que se muestra junto al cursor mientras se arrastra (o null).
export function textoTirador(col, o, g, campos) {
  if (g.tipo === 'radio') return `R = ${fmt(campos.r)} m`;
  if (g.tipo === 'angulo') return `${fmt(g.idx === 1 ? campos.a1 : campos.a2, 1)}°`;
  if (g.tipo === 'extremo') {
    const n = { ...o, ...campos };
    return `L = ${fmt(Math.hypot(n.x2 - n.x1, n.y2 - n.y1))} m`;
  }
  return null;
}