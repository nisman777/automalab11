// Cortes: dónde se cruzan las figuras y cómo queda cada una al borrar un tramo, partirla o agregarle un vértice.
// Este archivo solo calcula: no modifica el proyecto. Los cambios los aplica edicion.js.
import { RAD, norm360, barrido, anguloDe, puntoEnArco, distanciaASegmento, distanciaAObjeto, cajaDeObjeto, segmentosDePolilinea } from './geometria.js';
import { COLECCIONES_EDITABLES, elegibles } from './seleccion.js';


const EPS = 1e-6;       // metros: dos puntos más cerca que esto se consideran el mismo
const EPS_ANG = 1e-5;   // grados
const TOL_S = 1e-7;     // tolerancia en las posiciones a lo largo de una polilínea
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const limitar = (n, a, b) => Math.max(a, Math.min(b, n));
const ang6 = (a) => norm360(r6(a));


// Ordena y saca los valores repetidos (los que están a menos de tol del anterior).
function unicos(lista, tol) {
  const orden = [...lista].sort((a, b) => a - b);
  const res = [];
  for (const v of orden) {
    if (!res.length || v - res[res.length - 1] > tol) res.push(v);
  }
  return res;
}


// ---- Figuras simples para calcular cruces: segmentos y circunferencias (con rango si son arcos) ----
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


// Cruce de dos segmentos (si se tocan en un extremo, también cuenta).
function cortesSegSeg(a, b) {
  const rx = a.x2 - a.x1, ry = a.y2 - a.y1, sx = b.x2 - b.x1, sy = b.y2 - b.y1;
  const la = Math.hypot(rx, ry), lb = Math.hypot(sx, sy);
  if (la < 1e-9 || lb < 1e-9) return [];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9 * la * lb) {
    // Paralelos: si b está encima de a, los extremos de b que caen sobre a cuentan como cruce.
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


// Cruce de una circunferencia (o arco) con un segmento.
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


// Cruce de dos circunferencias (o arcos).
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


// Todos los puntos donde otras figuras visibles de la planta cruzan (o tocan) a este objeto.
function puntosDeCruce(p, col, o) {
  const propias = primitivas(col, o);
  const caja = cajaDeObjeto(col, o);
  const capas = new Map(p.capas.map((c) => [c.id, c]));
  const pts = [];
  for (const col2 of COLECCIONES_EDITABLES) {
    for (const o2 of p[col2]) {
      if (col2 === col && o2.id === o.id) continue;
      if (o2.planta !== o.planta || capas.get(o2.capa)?.visible === false) continue;
      const c2 = cajaDeObjeto(col2, o2);
      if (c2.x0 > caja.x1 + EPS || c2.x1 < caja.x0 - EPS || c2.y0 > caja.y1 + EPS || c2.y1 < caja.y0 - EPS) continue;
      for (const b of primitivas(col2, o2)) {
        for (const a of propias) pts.push(...interseccion(a, b));
      }
    }
  }
  return pts;
}


// Objeto elegible más cercano al punto (en píxeles). columnas: lista de colecciones permitidas, o null para todas.
export function objetoCercano(p, vista, px, py, columnas = null, tolerancia = 6) {
  const m = vista.aMundo(px, py);
  let mejor = null;
  let dMejor = Infinity;
  for (const h of elegibles(p)) {
    if (columnas && !columnas.includes(h.col)) continue;
    const d = distanciaAObjeto(h.col, h.o, m.x, m.y) * vista.escala;
    const mitad = h.col === 'muros' ? ((h.o.espesor || 0) * vista.escala) / 2 : 0;
    if (d <= Math.max(tolerancia, mitad) && d < dMejor) {
      mejor = h;
      dMejor = d;
    }
  }
  return mejor;
}


// ---- Líneas y muros: posición t de 0 a 1 ----
function camposRecta(o, t0, t1) {
  const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
  return { x1: r6(o.x1 + t0 * dx), y1: r6(o.y1 + t0 * dy), x2: r6(o.x1 + t1 * dx), y2: r6(o.y1 + t1 * dy) };
}


function tramoRecta(p, col, o, x, y) {
  const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return { error: 'Ese objeto mide cero.' };
  const tDe = (q) => ((q.x - o.x1) * dx + (q.y - o.y1) * dy) / (L * L);
  const et = EPS / L;
  const cortes = unicos(puntosDeCruce(p, col, o).map(tDe).filter((t) => t > et && t < 1 - et), et);
  const tc = limitar(tDe({ x, y }), 0, 1);
  let lo = 0, hi = 1;
  for (const c of cortes) {
    if (c <= tc) lo = c;
    else { hi = c; break; }
  }
  const piezas = [];
  if (lo > et) piezas.push({ col, campos: camposRecta(o, 0, lo) });
  if (hi < 1 - et) piezas.push({ col, campos: camposRecta(o, hi, 1) });
  const datos = col === 'muros' ? { ...camposRecta(o, lo, hi), espesor: o.espesor } : camposRecta(o, lo, hi);
  return { col, o, piezas, entero: !piezas.length, tramo: { col, datos }, punto: null };
}


function partirRecta(col, o, x, y) {
  const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return { error: 'Ese objeto mide cero.' };
  const t = limitar(((x - o.x1) * dx + (y - o.y1) * dy) / (L * L), 0, 1);
  const et = 1e-4 / L;
  if (t <= et || t >= 1 - et) return { error: 'Ese punto está en un extremo. Elegí un punto del medio.' };
  return {
    col, o, tramo: null, entero: false,
    punto: { x: r6(o.x1 + t * dx), y: r6(o.y1 + t * dy) },
    piezas: [{ col, campos: camposRecta(o, 0, t) }, { col, campos: camposRecta(o, t, 1) }],
  };
}


// ---- Arcos: posición d en grados, de 0 a barrido, contada desde a1 ----
function tramoArco(p, col, o, x, y) {
  const B = barrido(o.a1, o.a2);
  const e = EPS / o.r / RAD;
  const dDe = (q) => norm360(anguloDe(o.cx, o.cy, q.x, q.y) - o.a1);
  const cortes = unicos(puntosDeCruce(p, col, o).map(dDe).filter((d) => d > e && d < B - e), e);
  let dc = dDe({ x, y });
  if (dc > B) dc = dc - B < 360 - dc ? B : 0;
  let lo = 0, hi = B;
  for (const c of cortes) {
    if (c <= dc) lo = c;
    else { hi = c; break; }
  }
  const piezas = [];
  if (lo > e) piezas.push({ col, campos: { a1: ang6(o.a1), a2: ang6(o.a1 + lo) } });
  if (hi < B - e) piezas.push({ col, campos: { a1: ang6(o.a1 + hi), a2: ang6(o.a2) } });
  const tramo = { col: 'arcos', datos: { cx: o.cx, cy: o.cy, r: o.r, a1: ang6(o.a1 + lo), a2: ang6(o.a1 + hi) } };
  return { col, o, piezas, entero: !piezas.length, tramo, punto: null };
}


function partirArco(col, o, x, y) {
  const B = barrido(o.a1, o.a2);
  const e = EPS / o.r / RAD;
  let d = norm360(anguloDe(o.cx, o.cy, x, y) - o.a1);
  if (d > B) d = d - B < 360 - d ? B : 0;
  if (d <= e || d >= B - e) return { error: 'Ese punto está en un extremo del arco. Elegí un punto del medio.' };
  const q = puntoEnArco(o, o.a1 + d);
  return {
    col, o, tramo: null, entero: false,
    punto: { x: r6(q.x), y: r6(q.y) },
    piezas: [
      { col, campos: { a1: ang6(o.a1), a2: ang6(o.a1 + d) } },
      { col, campos: { a1: ang6(o.a1 + d), a2: ang6(o.a2) } },
    ],
  };
}


// ---- Círculos: ángulos de 0 a 360 ----
function tramoCirculo(p, col, o, x, y) {
  const e = EPS / o.r / RAD;
  const cortes = unicos(puntosDeCruce(p, col, o).map((q) => anguloDe(o.cx, o.cy, q.x, q.y)), e);
  if (cortes.length > 1 && cortes[0] + 360 - cortes[cortes.length - 1] < e) cortes.pop();
  if (cortes.length < 2) {
    return { col, o, piezas: [], entero: true, tramo: { col: 'circulos', datos: o }, punto: null };
  }
  const ac = anguloDe(o.cx, o.cy, x, y);
  let lo = cortes[cortes.length - 1];
  let hi = cortes[0];
  for (let i = 0; i < cortes.length; i++) {
    if (cortes[i] <= ac) {
      lo = cortes[i];
      hi = cortes[(i + 1) % cortes.length];
    }
  }
  return {
    col, o, entero: false, punto: null,
    // Se borra de lo a hi; queda el arco que va de hi a lo (el círculo pasa a ser un arco).
    piezas: [{ col: 'arcos', campos: { cx: o.cx, cy: o.cy, r: o.r, a1: ang6(hi), a2: ang6(lo) } }],
    tramo: { col: 'arcos', datos: { cx: o.cx, cy: o.cy, r: o.r, a1: ang6(lo), a2: ang6(hi) } },
  };
}


// ---- Polilíneas: posición s = número de tramo + fracción (0 a n-1 si es abierta; 0 a n si es cerrada) ----
const sinRuido = (s) => {
  const r = Math.round(s);
  return Math.abs(s - r) < TOL_S ? r : s;
};


// Posición s del punto de la polilínea más cercano a (x, y) y su distancia.
function parametroPolilinea(o, x, y) {
  const q = o.puntos;
  const n = q.length;
  const ns = o.cerrada ? n : n - 1;
  let mejor = { s: 0, d: Infinity };
  for (let i = 0; i < ns; i++) {
    const a = q[i], b = q[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = limitar(l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0, 0, 1);
    const d = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
    if (d < mejor.d - 1e-12) mejor = { s: i + t, d };
  }
  let s = sinRuido(mejor.s);
  if (o.cerrada && s >= n) s -= n;
  return { s, d: mejor.d };
}


function puntoEnPolilinea(o, s) {
  const q = o.puntos;
  const n = q.length;
  const i = Math.floor(s + 1e-9);
  if (!o.cerrada && i >= n - 1) return { x: q[n - 1].x, y: q[n - 1].y };
  const t = s - i;
  const a = q[i % n], b = q[(i + 1) % n];
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}


// Los puntos de la polilínea desde la posición sa hasta la sb (sb puede pasar de n si es cerrada).
function puntosEntre(o, sa, sb) {
  const q = o.puntos;
  const n = q.length;
  const lista = [puntoEnPolilinea(o, sa)];
  for (let k = Math.floor(sa + TOL_S) + 1; k < sb - TOL_S; k++) lista.push({ x: q[k % n].x, y: q[k % n].y });
  lista.push(puntoEnPolilinea(o, sb));
  const res = [];
  for (const pt of lista) {
    const r = { x: r6(pt.x), y: r6(pt.y) };
    const ult = res[res.length - 1];
    if (!ult || Math.hypot(r.x - ult.x, r.y - ult.y) > 1e-9) res.push(r);
  }
  return res;
}


function tramoPolilinea(p, col, o, x, y) {
  const n = o.puntos.length;
  const ns = o.cerrada ? n : n - 1;
  const deCruces = puntosDeCruce(p, col, o).map((q) => parametroPolilinea(o, q.x, q.y).s);
  const vertices = [];
  for (let k = o.cerrada ? 0 : 1; k < (o.cerrada ? n : n - 1); k++) vertices.push(k);
  let cortes = unicos([...deCruces, ...vertices], TOL_S);
  if (!o.cerrada) cortes = cortes.filter((s) => s > TOL_S && s < ns - TOL_S);
  const sc = parametroPolilinea(o, x, y).s;
  let lo = 0;
  let hi = o.cerrada ? n : ns;
  for (const c of cortes) {
    if (c <= sc) lo = c;
    else { hi = c; break; }
  }
  const piezas = [];
  if (o.cerrada) {
    // Queda lo que va de hi hasta lo, dando la vuelta: una polilínea abierta.
    const resto = puntosEntre(o, hi, lo + n);
    if (resto.length >= 2) piezas.push({ col, campos: { puntos: resto, cerrada: false } });
  } else {
    const a = lo > TOL_S ? puntosEntre(o, 0, lo) : [];
    const b = hi < ns - TOL_S ? puntosEntre(o, hi, ns) : [];
    if (a.length >= 2) piezas.push({ col, campos: { puntos: a, cerrada: false } });
    if (b.length >= 2) piezas.push({ col, campos: { puntos: b, cerrada: false } });
  }
  const tramo = { col: 'polilineas', datos: { puntos: puntosEntre(o, lo, hi), cerrada: false } };
  return { col, o, piezas, entero: !piezas.length, tramo, punto: null };
}


function partirPolilinea(col, o, x, y) {
  const n = o.puntos.length;
  const ns = o.cerrada ? n : n - 1;
  const { s } = parametroPolilinea(o, x, y);
  if (!o.cerrada && (s <= TOL_S || s >= ns - TOL_S)) {
    return { error: 'Ese punto está en un extremo de la polilínea. Elegí un punto del medio.' };
  }
  const q = puntoEnPolilinea(o, s);
  const piezas = [];
  if (o.cerrada) {
    piezas.push({ col, campos: { puntos: puntosEntre(o, s, s + n), cerrada: false } });
  } else {
    piezas.push({ col, campos: { puntos: puntosEntre(o, 0, s), cerrada: false } });
    piezas.push({ col, campos: { puntos: puntosEntre(o, s, ns), cerrada: false } });
  }
  if (piezas.some((z) => z.campos.puntos.length < 2)) return { error: 'No se puede partir ahí: quedaría un pedazo de largo cero.' };
  return { col, o, tramo: null, entero: false, punto: { x: r6(q.x), y: r6(q.y) }, piezas };
}


// ---- Lo que se usa desde el editor ----


// Plan para "Borrar tramo": { col, o, piezas, entero, tramo, punto } o { error }.
// piezas = lo que queda (cada una { col, campos }); tramo = lo que se borra, para dibujarlo en rojo.
export function planDeTramo(p, col, o, x, y) {
  switch (col) {
    case 'circulos': return tramoCirculo(p, col, o, x, y);
    case 'arcos': return tramoArco(p, col, o, x, y);
    case 'polilineas': return tramoPolilinea(p, col, o, x, y);
    default: return tramoRecta(p, col, o, x, y);
  }
}


// Plan para "Partir" en el punto (x, y) (se proyecta sobre el objeto).
export function planDePartir(col, o, x, y) {
  switch (col) {
    case 'circulos': return { error: 'Un círculo no se puede partir en un solo punto. Con "Borrar tramo" podés sacarle un pedazo entre dos cruces.' };
    case 'arcos': return partirArco(col, o, x, y);
    case 'polilineas': return partirPolilinea(col, o, x, y);
    default: return partirRecta(col, o, x, y);
  }
}


// Plan para "Agregar vértice" a una polilínea.
export function planDeVertice(o, x, y) {
  const q = o.puntos;
  const n = q.length;
  const { s } = parametroPolilinea(o, x, y);
  const i = Math.floor(s + 1e-9);
  const t = s - i;
  const a = q[i], b = q[(i + 1) % n];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (t * L < 1e-4 || (1 - t) * L < 1e-4) return { error: 'Ahí ya hay un vértice. Elegí otro punto del tramo.' };
  const punto = { x: r6(a.x + t * (b.x - a.x)), y: r6(a.y + t * (b.y - a.y)) };
  const puntos = q.map((c) => ({ x: c.x, y: c.y }));
  puntos.splice(i + 1, 0, punto);
  return { col: 'polilineas', o, tramo: null, entero: false, punto, piezas: [{ col: 'polilineas', campos: { puntos } }] };
}