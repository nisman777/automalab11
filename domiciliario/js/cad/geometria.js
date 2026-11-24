// Geometría pura: arcos, distancias, cajas e intersecciones. No dibuja ni toca el proyecto.
// Los ángulos van en grados, 0 = Este, sentido antihorario (como en AutoCAD).

export const RAD = Math.PI / 180;
const limpiar = (n) => Math.round(n * 1e6) / 1e6;

export const fmt = (n, d) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const norm360 = (a) => ((a % 360) + 360) % 360;
// Cuántos grados recorre un arco que va (antihorario) de a1 a a2. Si coinciden, es 360.
export const barrido = (a1, a2) => { const d = norm360(a2 - a1); return d < 1e-9 ? 360 : d; };
export const anguloDe = (cx, cy, x, y) => norm360(Math.atan2(y - cy, x - cx) / RAD);
export const puntoEnArco = (a, ang) => ({ x: a.cx + a.r * Math.cos(ang * RAD), y: a.cy + a.r * Math.sin(ang * RAD) });
export const anguloEnArco = (a, ang) => norm360(ang - a.a1) <= barrido(a.a1, a.a2) + 1e-9;


// Texto "largo m ∠ ángulo°" entre dos puntos.
export function textoMedida(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let ang = Math.atan2(dy, dx) / RAD;
  if (ang < 0) ang += 360;
  return `${fmt(Math.hypot(dx, dy), 2)} m  ∠ ${fmt(ang, 1)}°`;
}


// Arco que pasa por tres puntos (inicio, intermedio, fin). null si están alineados.
export function arcoPorTresPuntos(p1, p2, p3) {
  const bx = p2.x - p1.x, by = p2.y - p1.y, cx = p3.x - p1.x, cy = p3.y - p1.y;
  const d = 2 * (bx * cy - by * cx);
  if (Math.abs(d) < 1e-12) return null;
  const b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d;
  const uy = (bx * c2 - cx * b2) / d;
  const r = Math.hypot(ux, uy);
  if (!(r > 1e-6) || r > 1e5) return null;
  const x0 = p1.x + ux, y0 = p1.y + uy;
  const a1 = anguloDe(x0, y0, p1.x, p1.y);
  const am = anguloDe(x0, y0, p2.x, p2.y);
  const a3 = anguloDe(x0, y0, p3.x, p3.y);
  const pasa = norm360(am - a1) < norm360(a3 - a1);   // ¿p2 está entre p1 y p3, yendo antihorario?
  return { cx: limpiar(x0), cy: limpiar(y0), r: limpiar(r), a1: limpiar(pasa ? a1 : a3), a2: limpiar(pasa ? a3 : a1) };
}


// Arco por centro, punto inicial (define el radio) y punto final (define el ángulo). Va en sentido antihorario.
export function arcoCentroInicioFin(c, s, e) {
  const r = Math.hypot(s.x - c.x, s.y - c.y);
  if (r < 1e-6 || Math.hypot(e.x - c.x, e.y - c.y) < 1e-6) return null;
  const a1 = anguloDe(c.x, c.y, s.x, s.y);
  const a2 = anguloDe(c.x, c.y, e.x, e.y);
  const d = norm360(a2 - a1);
  if (d < 1e-6 || d > 360 - 1e-6) return null;
  return { cx: limpiar(c.x), cy: limpiar(c.y), r: limpiar(r), a1: limpiar(a1), a2: limpiar(a2) };
}


export function cajaDeArco(a) {
  const e1 = puntoEnArco(a, a.a1), e2 = puntoEnArco(a, a.a2);
  const c = { x0: Math.min(e1.x, e2.x), y0: Math.min(e1.y, e2.y), x1: Math.max(e1.x, e2.x), y1: Math.max(e1.y, e2.y) };
  for (const ang of [0, 90, 180, 270]) {
    if (!anguloEnArco(a, ang)) continue;
    const q = puntoEnArco(a, ang);
    c.x0 = Math.min(c.x0, q.x); c.y0 = Math.min(c.y0, q.y);
    c.x1 = Math.max(c.x1, q.x); c.y1 = Math.max(c.y1, q.y);
  }
  return c;
}


// Caja { x0, y0, x1, y1 } de cualquier objeto dibujable.
export function cajaDeObjeto(col, o) {
  switch (col) {
    case 'polilineas': {
      const c = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const q of o.puntos) {
        c.x0 = Math.min(c.x0, q.x); c.y0 = Math.min(c.y0, q.y);
        c.x1 = Math.max(c.x1, q.x); c.y1 = Math.max(c.y1, q.y);
      }
      return c;
    }
    case 'circulos': return { x0: o.cx - o.r, y0: o.cy - o.r, x1: o.cx + o.r, y1: o.cy + o.r };
    case 'arcos': return cajaDeArco(o);
    default: return { x0: Math.min(o.x1, o.x2), y0: Math.min(o.y1, o.y2), x1: Math.max(o.x1, o.x2), y1: Math.max(o.y1, o.y2) };
  }
}


// Los tramos de una polilínea como segmentos { x1, y1, x2, y2 } (con el de cierre si está cerrada).
export function segmentosDePolilinea(o) {
  const q = o.puntos;
  const r = [];
  for (let i = 0; i < q.length - 1; i++) r.push({ x1: q[i].x, y1: q[i].y, x2: q[i + 1].x, y2: q[i + 1].y });
  if (o.cerrada && q.length > 2) r.push({ x1: q[q.length - 1].x, y1: q[q.length - 1].y, x2: q[0].x, y2: q[0].y });
  return r;
}


export function distanciaASegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}


function distanciaAArco(a, x, y) {
  if (anguloEnArco(a, anguloDe(a.cx, a.cy, x, y))) return Math.abs(Math.hypot(x - a.cx, y - a.cy) - a.r);
  const e1 = puntoEnArco(a, a.a1), e2 = puntoEnArco(a, a.a2);
  return Math.min(Math.hypot(x - e1.x, y - e1.y), Math.hypot(x - e2.x, y - e2.y));
}


// Distancia (en metros) de un punto al trazo de un objeto.
export function distanciaAObjeto(col, o, x, y) {
  switch (col) {
    case 'polilineas': {
      let d = Infinity;
      for (const s of segmentosDePolilinea(o)) d = Math.min(d, distanciaASegmento(x, y, s.x1, s.y1, s.x2, s.y2));
      return d;
    }
    case 'circulos': return Math.abs(Math.hypot(x - o.cx, y - o.cy) - o.r);
    case 'arcos': return distanciaAArco(o, x, y);
    default: return distanciaASegmento(x, y, o.x1, o.y1, o.x2, o.y2);
  }
}


// ---- Ventana de selección (R = { x0, y0, x1, y1 } en metros) ----

export function cajaDentro(b, R) {
  return b.x0 >= R.x0 && b.x1 <= R.x1 && b.y0 >= R.y0 && b.y1 <= R.y1;
}


// ¿El segmento toca el rectángulo? (recorte de Liang-Barsky)
export function segmentoTocaRect(ax, ay, bx, by, R) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const pp = [-dx, dx, -dy, dy];
  const qq = [ax - R.x0, R.x1 - ax, ay - R.y0, R.y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (pp[i] === 0) {
      if (qq[i] < 0) return false;
    } else {
      const r = qq[i] / pp[i];
      if (pp[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}


function circuloTocaRect(o, R) {
  const dmin = Math.hypot(Math.max(R.x0 - o.cx, 0, o.cx - R.x1), Math.max(R.y0 - o.cy, 0, o.cy - R.y1));
  let dmax = 0;
  for (const x of [R.x0, R.x1]) for (const y of [R.y0, R.y1]) dmax = Math.max(dmax, Math.hypot(x - o.cx, y - o.cy));
  return dmin <= o.r && o.r <= dmax;
}


// Puntos donde el círculo corta al segmento.
function cortesCirculoSegmento(cx, cy, r, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-18) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const res = [];
  for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
    if (t >= -1e-9 && t <= 1 + 1e-9) res.push({ x: ax + t * dx, y: ay + t * dy });
  }
  return res;
}


function arcoTocaRect(a, R) {
  const dentro = (q) => q.x >= R.x0 && q.x <= R.x1 && q.y >= R.y0 && q.y <= R.y1;
  if (dentro(puntoEnArco(a, a.a1)) || dentro(puntoEnArco(a, a.a2))) return true;
  const lados = [
    [R.x0, R.y0, R.x1, R.y0], [R.x1, R.y0, R.x1, R.y1],
    [R.x1, R.y1, R.x0, R.y1], [R.x0, R.y1, R.x0, R.y0],
  ];
  for (const [ax, ay, bx, by] of lados) {
    for (const q of cortesCirculoSegmento(a.cx, a.cy, a.r, ax, ay, bx, by)) {
      if (anguloEnArco(a, anguloDe(a.cx, a.cy, q.x, q.y))) return true;
    }
  }
  return false;
}


// ¿El objeto toca el rectángulo? (selección "de derecha a izquierda")
export function objetoTocaRect(col, o, R) {
  switch (col) {
    case 'muros': {
      const m = (o.espesor || 0) / 2;
      return segmentoTocaRect(o.x1, o.y1, o.x2, o.y2, { x0: R.x0 - m, y0: R.y0 - m, x1: R.x1 + m, y1: R.y1 + m });
    }
    case 'polilineas': return segmentosDePolilinea(o).some((s) => segmentoTocaRect(s.x1, s.y1, s.x2, s.y2, R));
    case 'circulos': return circuloTocaRect(o, R);
    case 'arcos': return arcoTocaRect(o, R);
    default: return segmentoTocaRect(o.x1, o.y1, o.x2, o.y2, R);
  }
}