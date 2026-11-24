// Transformaciones geométricas puras: rotar, escalar, espejar y alinear.
// Solo calcula cómo queda cada objeto; no dibuja ni toca el proyecto.
import { RAD } from './geometria.js';

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const grados360 = (a) => {
  const n = r6(((a % 360) + 360) % 360);
  return n >= 360 ? 0 : n;
};

// Una transformación T es: (si espejo) se invierte Y, se rota "ang" grados, se multiplica por "s" y se corre (tx, ty).
export function aplicarAPunto(T, x, y) {
  const c = Math.cos(T.ang * RAD);
  const sn = Math.sin(T.ang * RAD);
  const yy = T.espejo ? -y : y;
  return { x: T.s * (c * x - sn * yy) + T.tx, y: T.s * (sn * x + c * yy) + T.ty };
}

// Arma T de modo que el punto "desde" vaya a parar a "hacia".
function conImagen(ang, espejo, s, desde, hacia) {
  const T0 = { ang, espejo, s, tx: 0, ty: 0 };
  const q = aplicarAPunto(T0, desde.x, desde.y);
  return { ...T0, tx: hacia.x - q.x, ty: hacia.y - q.y };
}

export const traslacion = (dx, dy) => ({ ang: 0, espejo: false, s: 1, tx: dx, ty: dy });
export const rotacion = (base, grados) => conImagen(grados, false, 1, base, base);
export const escalado = (base, factor) => conImagen(0, false, factor, base, base);

// Espejo respecto de la recta que pasa por p1 y p2.
export function reflexion(p1, p2) {
  const fi = Math.atan2(p2.y - p1.y, p2.x - p1.x) / RAD;
  return conImagen(2 * fi, true, 1, p1, p1);
}

// Alinear: un par de puntos = solo mover; dos pares = mover y girar (y escalar si se pide).
export function alineacion(s1, d1, s2 = null, d2 = null, escalar = false) {
  if (!s2 || !d2) return traslacion(d1.x - s1.x, d1.y - s1.y);
  const ls = Math.hypot(s2.x - s1.x, s2.y - s1.y);
  const ld = Math.hypot(d2.x - d1.x, d2.y - d1.y);
  if (ls < 1e-9 || ld < 1e-9) return traslacion(d1.x - s1.x, d1.y - s1.y);
  const as = Math.atan2(s2.y - s1.y, s2.x - s1.x);
  const ad = Math.atan2(d2.y - d1.y, d2.x - d1.x);
  return conImagen((ad - as) / RAD, false, escalar ? ld / ls : 1, s1, d1);
}

// Campos que cambian en un objeto al aplicarle T. El espesor de los muros no se escala.
export function camposTransformados(col, o, T) {
  const P = (x, y) => {
    const q = aplicarAPunto(T, x, y);
    return { x: r6(q.x), y: r6(q.y) };
  };
  if (col === 'polilineas') return { puntos: o.puntos.map((q) => P(q.x, q.y)) };
  if (col === 'circulos') {
    const c = P(o.cx, o.cy);
    return { cx: c.x, cy: c.y, r: r6(o.r * T.s) };
  }
  if (col === 'arcos') {
    const c = P(o.cx, o.cy);
    // Con espejo el arco cambia de sentido: el extremo final pasa a ser el inicial.
    const a1 = T.espejo ? T.ang - o.a2 : T.ang + o.a1;
    const a2 = T.espejo ? T.ang - o.a1 : T.ang + o.a2;
    return { cx: c.x, cy: c.y, r: r6(o.r * T.s), a1: grados360(a1), a2: grados360(a2) };
  }
  const a = P(o.x1, o.y1);
  const b = P(o.x2, o.y2);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

// Devuelve un texto de error si la transformación dejaría objetos inválidos; si está bien, null.
export function errorDeTransformacion(lista, T) {
  if (!(T.s >= 0.001 && T.s <= 1000)) return 'El factor de escala tiene que estar entre 0,001 y 1000.';
  for (const { col, o } of lista) {
    if (col === 'circulos' || col === 'arcos') {
      const r = r6(o.r * T.s);
      if (!(r > 0 && r < 1e5)) return 'Un círculo o arco quedaría demasiado chico o demasiado grande.';
    }
  }
  return null;
}