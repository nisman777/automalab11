// Construcción: cómo quedan las figuras al extenderlas, empalmarlas, achaflanarlas o desfasarlas.
// Este archivo solo calcula: no modifica el proyecto. Los cambios los aplica edicion.js (aplicarObra).
import { RAD, fmt, norm360, barrido, anguloDe, puntoEnArco, distanciaASegmento, segmentosDePolilinea } from './geometria.js';
import { COLECCIONES_EDITABLES } from './seleccion.js';
import { clonar } from '../core/modelo.js';

const EPS = 1e-6;       // metros
const EPS_ANG = 1e-5;   // grados
const LARGO = 1e4;      // metros: hasta dónde se busca "adelante" al extender
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const limitar = (n, a, b) => Math.max(a, Math.min(b, n));
const ang6 = (a) => norm360(r6(a));
const clave = (col, o) => `${col}:${o.id}`;

// ---- Cruces entre figuras simples (segmentos y circunferencias, con rango si son arcos) ----
function primitivas(col, o) {
  switch (col) {
    case 'polilineas': return segmentosDePolilinea(o).map((s) => ({ t: 's', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }));
    case 'circulos': return [{ t: 'c', cx: o.cx, cy: o.cy, r: o.r, rango: null }];
    case 'arcos': return [{ t: 'c', cx: o.cx, cy: o.cy, r: o.r, rango: { a1: o.a1, a2: o.a2 } }];
    default: return [{ t: 's', x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 }];
  }
}

function enRango(c, x, y) {
  if (!c.rango) return true;
  const d = norm360(anguloDe(c.cx, c.cy, x, y) - c.rango.a1);
  return d <= barrido(c.rango.a1, c.rango.a2) + EPS_ANG || d >= 360 - EPS_ANG;
}

function cortesSegSeg(a, b) {
  const rx = a.x2 - a.x1, ry = a.y2 - a.y1, sx = b.x2 - b.x1, sy = b.y2 - b.y1;
  const la = Math.hypot(rx, ry), lb = Math.hypot(sx, sy);
  if (la < 1e-9 || lb < 1e-9) return [];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9 * la * lb) {
    const res = [];
    for (const q of [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }]) {
      if (distanciaASegmento(q.x, q.y, a.x1, a.y1, a.x2, a.y2) < EPS) res.push(q);
    }
    return res;
  }
  const qx = b.x1 - a.x1, qy = b.y1 - a.y1;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  const et = EPS / la, eu = EPS / lb;
  if (t < -et || t > 1 + et || u < -eu || u > 1 + eu) return [];
  return [{ x: a.x1 + t * rx, y: a.y1 + t * ry }];
}

function cortesCircSeg(c, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const A = dx * dx + dy * dy;
  if (A < 1e-18) return [];
  const fx = s.x1 - c.cx, fy = s.y1 - c.cy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - c.r * c.r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const raiz = Math.sqrt(disc);
  const et = EPS / Math.sqrt(A);
  const res = [];
  for (const t of [(-B - raiz) / (2 * A), (-B + raiz) / (2 * A)]) {
    if (t < -et || t > 1 + et) continue;
    const q = { x: s.x1 + t * dx, y: s.y1 + t * dy };
    if (enRango(c, q.x, q.y)) res.push(q);
  }
  return res;
}

function cortesCircCirc(a, b) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return [];
  if (d > a.r + b.r + EPS || d < Math.abs(a.r - b.r) - EPS) return [];
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h2 = a.r * a.r - l * l;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const mx = a.cx + (l * dx) / d, my = a.cy + (l * dy) / d;
  const pts = h < 1e-9
    ? [{ x: mx, y: my }]
    : [{ x: mx + (h * dy) / d, y: my - (h * dx) / d }, { x: mx - (h * dy) / d, y: my + (h * dx) / d }];
  return pts.filter((q) => enRango(a, q.x, q.y) && enRango(b, q.x, q.y));
}

function interseccion(a, b) {
  if (a.t === 's') return b.t === 's' ? cortesSegSeg(a, b) : cortesCircSeg(b, a);
  return b.t === 's' ? cortesCircSeg(a, b) : cortesCircCirc(a, b);
}

// Todas las figuras visibles de la misma planta, menos el propio objeto (los "topes").
function topes(p, col, o) {
  const capas = new Map(p.capas.map((c) => [c.id, c]));
  const res = [];
  for (const col2 of COLECCIONES_EDITABLES) {
    for (const o2 of p[col2]) {
      if (col2 === col && o2.id === o.id) continue;
      if (o2.planta !== o.planta || capas.get(o2.capa)?.visible === false) continue;
      res.push(...primitivas(col2, o2));
    }
  }
  return res;
}

const datosRecta = (col, o, x1, y1, x2, y2) => (
  col === 'muros' ? { x1: r6(x1), y1: r6(y1), x2: r6(x2), y2: r6(y2), espesor: o.espesor } : { x1: r6(x1), y1: r6(y1), x2: r6(x2), y2: r6(y2) }
);

// ---- EXTENDER ----
function extenderRecta(p, col, o, x, y) {
  const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return { error: 'Ese objeto mide cero.' };
  const t = ((x - o.x1) * dx + (y - o.y1) * dy) / (L * L);
  const fin = t >= 0.5 ? 2 : 1;
  const ux = dx / L, uy = dy / L;
  const E = fin === 2 ? { x: o.x2, y: o.y2 } : { x: o.x1, y: o.y1 };
  const dir = fin === 2 ? { x: ux, y: uy } : { x: -ux, y: -uy };
  const rayo = { t: 's', x1: E.x, y1: E.y, x2: E.x + dir.x * LARGO, y2: E.y + dir.y * LARGO };
  let mejor = null;
  let dm = Infinity;
  for (const b of topes(p, col, o)) {
    for (const q of interseccion(rayo, b)) {
      const d = (q.x - E.x) * dir.x + (q.y - E.y) * dir.y;
      if (d > 1e-4 && d < dm) { dm = d; mejor = q; }
    }
  }
  if (!mejor) return { error: 'Adelante de ese extremo no hay ningún objeto contra el cual extender.' };
  const N = { x: r6(mejor.x), y: r6(mejor.y) };
  const campos = fin === 2 ? { x2: N.x, y2: N.y } : { x1: N.x, y1: N.y };
  return {
    cambios: [{ col, id: o.id, campos }],
    agregar: [],
    vista: { resaltar: [], nuevos: [{ col, datos: datosRecta(col, o, E.x, E.y, N.x, N.y) }], quitar: [], marcas: [N] },
    hecho: `Extendido ${fmt(dm, 2)} m.`,
  };
}

function extenderArco(p, col, o, x, y) {
  const B = barrido(o.a1, o.a2);
  const hueco = 360 - B;
  if (hueco < 1e-4) return { error: 'Ese arco ya es una circunferencia completa.' };
  const am = norm360(anguloDe(o.cx, o.cy, x, y) - o.a1);
  const fin = am <= B ? (am >= B / 2 ? 2 : 1) : ((am - B) < (360 - am) ? 2 : 1);
  const circ = { t: 'c', cx: o.cx, cy: o.cy, r: o.r, rango: null };
  let dm = Infinity;
  for (const b of topes(p, col, o)) {
    for (const q of interseccion(circ, b)) {
      const ang = anguloDe(o.cx, o.cy, q.x, q.y);
      const delta = fin === 2 ? norm360(ang - o.a2) : norm360(o.a1 - ang);
      if (delta > 1e-3 && delta < hueco - 1e-3 && delta < dm) dm = delta;
    }
  }
  if (!Number.isFinite(dm)) return { error: 'Adelante de ese extremo del arco no hay ningún objeto contra el cual extender.' };
  const nuevo = fin === 2 ? ang6(o.a2 + dm) : ang6(o.a1 - dm);
  const campos = fin === 2 ? { a2: nuevo } : { a1: nuevo };
  const pieza = fin === 2 ? { a1: ang6(o.a2), a2: nuevo } : { a1: nuevo, a2: ang6(o.a1) };
  const N = puntoEnArco(o, nuevo);
  return {
    cambios: [{ col, id: o.id, campos }],
    agregar: [],
    vista: {
      resaltar: [],
      nuevos: [{ col: 'arcos', datos: { cx: o.cx, cy: o.cy, r: o.r, ...pieza } }],
      quitar: [],
      marcas: [{ x: r6(N.x), y: r6(N.y) }],
    },
    hecho: `Arco extendido ${fmt(dm, 1)}°.`,
  };
}

// Plan para "Extender" el extremo más cercano al punto (x, y). col: lineas, muros o arcos.
export function planDeExtender(p, col, o, x, y) {
  return col === 'arcos' ? extenderArco(p, col, o, x, y) : extenderRecta(p, col, o, x, y);
}

// ---- EMPALME y CHAFLÁN ----
// tipo: 'empalme' | 'chaflan'. a, b: { col, o }. ca, cb: puntos donde se hizo clic (lado que se conserva).
// par: { radio, d1, d2 }
export function planDeEsquina(tipo, a, ca, b, cb, par) {
  const A = a.o, B = b.o;
  if (a.col === b.col && A.id === B.id) return { error: 'Elegí dos objetos distintos.' };
  const rad = tipo === 'empalme' ? par.radio : 0;
  if (rad > 0 && (a.col === 'muros' || b.col === 'muros')) {
    return { error: 'Con muros el radio tiene que ser 0 (esquina viva): un arco no puede ser un muro.' };
  }
  if (tipo === 'chaflan' && par.d1 <= 0 && par.d2 <= 0) {
    return { error: 'Las dos distancias están en cero. Escribí una distancia mayor (o usá Empalme para una esquina viva).' };
  }
  const dax = A.x2 - A.x1, day = A.y2 - A.y1, la = Math.hypot(dax, day);
  const dbx = B.x2 - B.x1, dby = B.y2 - B.y1, lb = Math.hypot(dbx, dby);
  if (la < 1e-9 || lb < 1e-9) return { error: 'Uno de los objetos mide cero.' };
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-9 * la * lb) return { error: 'Esos dos objetos son paralelos: nunca se cortan, no hay esquina que armar.' };
  const qx = B.x1 - A.x1, qy = B.y1 - A.y1;
  const ta = (qx * dby - qy * dbx) / den;
  const tb = (qx * day - qy * dax) / den;
  const P = { x: A.x1 + ta * dax, y: A.y1 + ta * day };
  if (Math.hypot(P.x - A.x1, P.y - A.y1) > 1e5) return { error: 'Esos objetos casi son paralelos: la esquina queda demasiado lejos.' };
  const tca = ((ca.x - A.x1) * dax + (ca.y - A.y1) * day) / (la * la);
  const tcb = ((cb.x - B.x1) * dbx + (cb.y - B.y1) * dby) / (lb * lb);
  // Se conserva el lado donde se hizo clic: sa = +1 si es el lado del extremo 2, -1 si es el del extremo 1.
  const sa = tca > ta ? 1 : -1;
  const sb = tcb > tb ? 1 : -1;
  const lenA = ((sa === 1 ? 1 : 0) - ta) * sa * la;
  const lenB = ((sb === 1 ? 1 : 0) - tb) * sb * lb;
  if (lenA < 1e-6 || lenB < 1e-6) {
    return { error: 'La esquina cae fuera del tramo elegido. Hacé clic más cerca del extremo que querés conservar.' };
  }
  const uA = { x: (sa * dax) / la, y: (sa * day) / la };
  const uB = { x: (sb * dbx) / lb, y: (sb * dby) / lb };

  let th = 0;
  let d1 = 0, d2 = 0;
  if (tipo === 'chaflan') {
    d1 = par.d1;
    d2 = par.d2;
  } else if (rad > 0) {
    th = Math.acos(limitar(uA.x * uB.x + uA.y * uB.y, -1, 1));
    if (th < 1e-3 || th > Math.PI - 1e-3) return { error: 'Esas dos líneas casi son paralelas: no se puede redondear la esquina.' };
    d1 = d2 = rad / Math.tan(th / 2);
  }
  if (d1 > lenA - 1e-6 || d2 > lenB - 1e-6) {
    return { error: tipo === 'chaflan'
      ? 'Esa distancia es mayor que el tramo que queda en uno de los lados. Probá con una menor.'
      : 'El radio es demasiado grande para estos tramos. Probá con uno menor.' };
  }
  const TA = { x: P.x + uA.x * d1, y: P.y + uA.y * d1 };
  const TB = { x: P.x + uB.x * d2, y: P.y + uB.y * d2 };
  const campA = sa === 1 ? { x1: r6(TA.x), y1: r6(TA.y) } : { x2: r6(TA.x), y2: r6(TA.y) };
  const campB = sb === 1 ? { x1: r6(TB.x), y1: r6(TB.y) } : { x2: r6(TB.x), y2: r6(TB.y) };

  // Lo que se saca de cada objeto (para mostrarlo en rojo).
  const quitar = [];
  const tTA = ta + (sa * d1) / la;
  const tTB = tb + (sb * d2) / lb;
  if (sa === 1 && tTA > 1e-9) quitar.push({ col: a.col, datos: datosRecta(a.col, A, A.x1, A.y1, A.x1 + tTA * dax, A.y1 + tTA * day) });
  if (sa === -1 && tTA < 1 - 1e-9) quitar.push({ col: a.col, datos: datosRecta(a.col, A, A.x1 + tTA * dax, A.y1 + tTA * day, A.x2, A.y2) });
  if (sb === 1 && tTB > 1e-9) quitar.push({ col: b.col, datos: datosRecta(b.col, B, B.x1, B.y1, B.x1 + tTB * dbx, B.y1 + tTB * dby) });
  if (sb === -1 && tTB < 1 - 1e-9) quitar.push({ col: b.col, datos: datosRecta(b.col, B, B.x1 + tTB * dbx, B.y1 + tTB * dby, B.x2, B.y2) });

  // La pieza que une las dos: un tramo recto (chaflán) o un arco (empalme con radio).
  let extra = null;
  if (tipo === 'chaflan') {
    if (Math.hypot(TB.x - TA.x, TB.y - TA.y) < 1e-6) return { error: 'Con esas distancias no queda ningún tramo.' };
    const dosMuros = a.col === 'muros' && b.col === 'muros';
    const objeto = { planta: A.planta, capa: A.capa, x1: r6(TA.x), y1: r6(TA.y), x2: r6(TB.x), y2: r6(TB.y) };
    if (dosMuros) objeto.espesor = A.espesor;
    extra = { col: dosMuros ? 'muros' : 'lineas', objeto };
  } else if (rad > 0) {
    const bx = uA.x + uB.x, by = uA.y + uB.y;
    const bl = Math.hypot(bx, by);
    const dc = rad / Math.sin(th / 2);
    const C = { x: P.x + (bx / bl) * dc, y: P.y + (by / bl) * dc };
    const aA = anguloDe(C.x, C.y, TA.x, TA.y);
    const aB = anguloDe(C.x, C.y, TB.x, TB.y);
    const cruz = (TA.x - C.x) * (TB.y - C.y) - (TA.y - C.y) * (TB.x - C.x);
    const a1 = cruz > 0 ? aA : aB;
    const a2 = cruz > 0 ? aB : aA;
    extra = { col: 'arcos', objeto: { planta: A.planta, capa: A.capa, cx: r6(C.x), cy: r6(C.y), r: r6(rad), a1: ang6(a1), a2: ang6(a2) } };
  }

  const nuevos = [{ col: a.col, datos: { ...A, ...campA } }, { col: b.col, datos: { ...B, ...campB } }];
  if (extra) nuevos.push({ col: extra.col, datos: extra.objeto });
  let hecho = 'Esquina hecha.';
  if (tipo === 'chaflan') hecho = `Chaflán hecho (${fmt(d1, 2)} m y ${fmt(d2, 2)} m).`;
  else if (rad > 0) hecho = `Esquina redondeada con radio ${fmt(rad, 2)} m.`;
  return {
    cambios: [{ col: a.col, id: A.id, campos: campA }, { col: b.col, id: B.id, campos: campB }],
    agregar: extra ? [extra] : [],
    vista: { resaltar: [], nuevos, quitar, marcas: [{ x: P.x, y: P.y }] },
    hecho,
  };
}

// ---- DESFASE ----
const nuevoDe = (o, campos) => {
  const n = clonar(o);
  delete n.id;
  return Object.assign(n, campos);
};

// Junta dos rectas desplazadas consecutivas (esquina "a inglete"; si es muy aguda, se corta en bisel).
function unirRectas(r1, r2, V, dist) {
  const c = r1.ux * r2.uy - r1.uy * r2.ux;
  if (Math.abs(c) > 1e-9) {
    const t = ((r2.ax - r1.ax) * r2.uy - (r2.ay - r1.ay) * r2.ux) / c;
    const m = { x: r1.ax + t * r1.ux, y: r1.ay + t * r1.uy };
    if (Math.hypot(m.x - V.x, m.y - V.y) <= 6 * dist) return { fin: m, ini: m };
  }
  return { fin: { x: r1.ax + r1.dx, y: r1.ay + r1.dy }, ini: { x: r2.ax, y: r2.ay } };
}

function desfasarPolilinea(o, dist, x, y) {
  const q = o.puntos;
  const segs = segmentosDePolilinea(o);
  if (!segs.length) return { error: 'La polilínea no tiene tramos.' };
  let mejor = 0;
  let dm = Infinity;
  segs.forEach((s, i) => {
    const d = distanciaASegmento(x, y, s.x1, s.y1, s.x2, s.y2);
    if (d < dm - 1e-12) { dm = d; mejor = i; }
  });
  const sm = segs[mejor];
  const lado = ((sm.x2 - sm.x1) * (y - sm.y1) - (sm.y2 - sm.y1) * (x - sm.x1)) >= 0 ? 1 : -1;
  const rs = [];
  for (const s of segs) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = Math.hypot(dx, dy);
    if (L < 1e-9) return { error: 'La polilínea tiene un tramo de largo cero.' };
    const ux = dx / L, uy = dy / L;
    rs.push({ ax: s.x1 - uy * lado * dist, ay: s.y1 + ux * lado * dist, dx, dy, ux, uy });
  }
  const m = rs.length;
  const S = new Array(m);
  const E = new Array(m);
  if (o.cerrada) {
    for (let i = 0; i < m; i++) {
      const prev = (i - 1 + m) % m;
      const j = unirRectas(rs[prev], rs[i], q[i], dist);
      E[prev] = j.fin;
      S[i] = j.ini;
    }
  } else {
    S[0] = { x: rs[0].ax, y: rs[0].ay };
    E[m - 1] = { x: rs[m - 1].ax + rs[m - 1].dx, y: rs[m - 1].ay + rs[m - 1].dy };
    for (let i = 1; i < m; i++) {
      const j = unirRectas(rs[i - 1], rs[i], q[i], dist);
      E[i - 1] = j.fin;
      S[i] = j.ini;
    }
  }
  for (let i = 0; i < m; i++) {
    if ((E[i].x - S[i].x) * rs[i].ux + (E[i].y - S[i].y) * rs[i].uy < 1e-6) {
      return { error: 'La distancia es demasiado grande para esta polilínea de ese lado: un tramo se daría vuelta. Probá con una menor.' };
    }
  }
  const pts = [];
  const sumar = (pt) => {
    const r = { x: r6(pt.x), y: r6(pt.y) };
    const u = pts[pts.length - 1];
    if (!u || Math.hypot(r.x - u.x, r.y - u.y) > 1e-9) pts.push(r);
  };
  for (let i = 0; i < m; i++) { sumar(S[i]); sumar(E[i]); }
  if (o.cerrada && pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) <= 1e-9) pts.pop();
  if (pts.length < (o.cerrada ? 3 : 2)) return { error: 'Con esa distancia la figura desaparece. Probá con una menor.' };
  return { campos: { puntos: pts, cerrada: !!o.cerrada } };
}

// Plan para "Desfase": copia paralela a distancia dist, del lado donde está el punto (x, y).
export function planDeDesfase(col, o, dist, x, y) {
  let campos;
  if (col === 'circulos' || col === 'arcos') {
    const dc = Math.hypot(x - o.cx, y - o.cy);
    const r2 = dc > o.r ? o.r + dist : o.r - dist;
    if (r2 <= 1e-6) return { error: 'Con esa distancia el radio queda en cero o negativo. Elegí el lado de afuera o una distancia menor.' };
    if (r2 >= 1e5) return { error: 'El radio resultante es demasiado grande.' };
    campos = { r: r6(r2) };
  } else if (col === 'polilineas') {
    const r = desfasarPolilinea(o, dist, x, y);
    if (r.error) return r;
    campos = r.campos;
  } else {
    const dx = o.x2 - o.x1, dy = o.y2 - o.y1, L = Math.hypot(dx, dy);
    if (L < 1e-9) return { error: 'Ese objeto mide cero.' };
    const s = (dx * (y - o.y1) - dy * (x - o.x1)) >= 0 ? 1 : -1;
    const nx = (-dy / L) * s * dist, ny = (dx / L) * s * dist;
    campos = { x1: r6(o.x1 + nx), y1: r6(o.y1 + ny), x2: r6(o.x2 + nx), y2: r6(o.y2 + ny) };
  }
  const objeto = nuevoDe(o, campos);
  return {
    cambios: [],
    agregar: [{ col, objeto }],
    vista: { resaltar: [clave(col, o)], nuevos: [{ col, datos: objeto }], quitar: [], marcas: [] },
    hecho: `Copia paralela creada a ${fmt(dist, 2)} m.`,
  };
}