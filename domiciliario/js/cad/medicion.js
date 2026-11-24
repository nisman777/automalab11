// Repetir y medir: matrices rectangular y polar, distancia y área. Solo calcula; no dibuja ni toca el proyecto.
import { RAD, fmt, cajaDeObjeto } from './geometria.js';
import { traslacion, rotacion, aplicarAPunto } from './transformar.js';


export const MAX_COPIAS = 500;
export const MAX_NUEVOS = 5000;
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const cero = (n) => (Math.abs(n) < 5e-7 ? 0 : n);


// Texto de error si se pasan los topes de copias u objetos nuevos; si está bien, null.
function topeSuperado(copias, nObjetos) {
  if (copias > MAX_COPIAS) return `Serían ${copias} copias; el máximo es ${MAX_COPIAS} por vez.`;
  if (copias * nObjetos > MAX_NUEVOS) {
    return `Serían ${copias * nObjetos} objetos nuevos; el máximo es ${MAX_NUEVOS} por vez. Elegí menos objetos o menos copias.`;
  }
  return null;
}


// ---- Matriz rectangular ----
// par = { filas, cols, sepf, sepc }. Las filas se apilan hacia arriba (Y) y las columnas van hacia la derecha (X).
// La separación se mide de un objeto al MISMO punto del siguiente; negativa = hacia el otro lado.
// Devuelve { Ts: [transformaciones de las copias], copias, hecho } o { error }.
export function planDeMatrizRect(par, nObjetos) {
  const { filas, cols, sepf, sepc } = par;
  if (!Number.isInteger(filas) || filas < 1 || !Number.isInteger(cols) || cols < 1) {
    return { error: 'Las filas y las columnas tienen que ser números enteros desde 1.' };
  }
  const copias = filas * cols - 1;
  if (copias < 1) return { error: 'Con 1 fila y 1 columna no hay nada que repetir.' };
  const tope = topeSuperado(copias, nObjetos);
  if (tope) return { error: tope };
  if (filas > 1 && !(Math.abs(sepf) >= 1e-9)) return { error: 'La separación entre filas no puede ser 0: las copias quedarían una encima de otra.' };
  if (cols > 1 && !(Math.abs(sepc) >= 1e-9)) return { error: 'La separación entre columnas no puede ser 0: las copias quedarían una encima de otra.' };
  const Ts = [];
  for (let i = 0; i < filas; i++) {
    for (let j = 0; j < cols; j++) {
      if (i === 0 && j === 0) continue;
      Ts.push(traslacion(r6(j * sepc), r6(i * sepf)));
    }
  }
  return { Ts, copias, hecho: `Matriz rectangular de ${filas} × ${cols}: ${copias} ${copias === 1 ? 'copia' : 'copias'}.` };
}


// ---- Matriz polar ----
// par = { cant, ang, gira }. cant cuenta el original. ang es el ángulo total (360 = vuelta completa; negativo = horario).
// centro = { x, y }; lista = [{ col, o }] (los objetos elegidos).
// Con gira = false las copias se corren sobre la circunferencia pero conservan su orientación.
export function planDeMatrizPolar(par, centro, lista) {
  const { cant, ang, gira } = par;
  if (!lista.length) return { error: 'No hay objetos elegidos.' };
  if (!Number.isInteger(cant) || cant < 2) return { error: 'La cantidad total (contando el original) tiene que ser un entero desde 2.' };
  const copias = cant - 1;
  const tope = topeSuperado(copias, lista.length);
  if (tope) return { error: tope };
  if (!Number.isFinite(ang) || Math.abs(ang) < 1e-9 || Math.abs(ang) > 360 + 1e-9) {
    return { error: 'El ángulo total tiene que estar entre -360 y 360, y no puede ser 0.' };
  }
  let c = null;
  for (const { col, o } of lista) {
    const b = cajaDeObjeto(col, o);
    c = c
      ? { x0: Math.min(c.x0, b.x0), y0: Math.min(c.y0, b.y0), x1: Math.max(c.x1, b.x1), y1: Math.max(c.y1, b.y1) }
      : { ...b };
  }
  const c0 = { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 };
  if (!gira && Math.hypot(c0.x - centro.x, c0.y - centro.y) < 1e-9) {
    return { error: 'Los objetos están centrados justo en el centro de la matriz: sin girar, las copias quedarían encima. Elegí otro centro.' };
  }
  const completa = Math.abs(ang) >= 360 - 1e-9;
  const paso = completa ? ang / cant : ang / (cant - 1);
  const Ts = [];
  for (let i = 1; i < cant; i++) {
    const R = rotacion(centro, r6(paso * i));
    if (gira) {
      Ts.push(R);
    } else {
      const q = aplicarAPunto(R, c0.x, c0.y);
      Ts.push(traslacion(q.x - c0.x, q.y - c0.y));
    }
  }
  return { Ts, copias, hecho: `Matriz polar de ${cant} objetos (${copias} ${copias === 1 ? 'copia' : 'copias'}).` };
}


// ---- Distancia ----
export function datosDeDistancia(a, b) {
  const dx = r6(b.x - a.x);
  const dy = r6(b.y - a.y);
  let ang = Math.atan2(dy, dx) / RAD;
  if (ang < 0) ang += 360;
  return { dist: Math.hypot(dx, dy), dx, dy, ang };
}


export function textoDistancia(d) {
  return `Distancia: ${fmt(d.dist, 3)} m  ·  ΔX ${fmt(cero(d.dx), 3)}  ·  ΔY ${fmt(cero(d.dy), 3)}  ·  ángulo ${fmt(d.ang, 2)}°`;
}


// ---- Área ----
const cruz = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const secantes = (p1, p2, p3, p4) => {
  const d1 = cruz(p3, p4, p1), d2 = cruz(p3, p4, p2), d3 = cruz(p1, p2, p3), d4 = cruz(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
};


// ¿Algún tramo del contorno cruza a otro que no es vecino? (contorno cerrado)
function contornoSeCruza(pts) {
  const n = pts.length;
  if (n < 4 || n > 500) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (secantes(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}


// Área y perímetro de un contorno cerrado de puntos [{ x, y }].
export function resumenDeArea(pts) {
  let suma = 0;
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    suma += a.x * b.y - b.x * a.y;
    per += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { area: Math.abs(suma) / 2, perimetro: per, cruza: contornoSeCruza(pts) };
}


// Área de un objeto ya dibujado: círculo o polilínea cerrada (el rectángulo lo es).
// Devuelve { area, perimetro, cruza, poligono: [puntos] | null, circulo: {cx, cy, r} | null } o { error }.
export function areaDeObjeto(col, o) {
  if (col === 'circulos') {
    return {
      area: Math.PI * o.r * o.r,
      perimetro: 2 * Math.PI * o.r,
      cruza: false,
      poligono: null,
      circulo: { cx: o.cx, cy: o.cy, r: o.r },
    };
  }
  if (col === 'polilineas') {
    if (!o.cerrada || o.puntos.length < 3) {
      return { error: 'Esa polilínea está abierta: no encierra un área. Cerrala (opción C al dibujar) o medí con clics por el contorno.' };
    }
    return { ...resumenDeArea(o.puntos), poligono: o.puntos.map((q) => ({ x: q.x, y: q.y })), circulo: null };
  }
  return { error: 'Solo se puede medir el área de un círculo o de una polilínea cerrada (el rectángulo lo es).' };
}


export function textoArea(r) {
  let t = `Área: ${fmt(r.area, 2)} m²  ·  Perímetro: ${fmt(r.perimetro, 2)} m`;
  if (r.cruza) t += '  ·  Atención: el contorno se cruza a sí mismo, el área puede no ser la esperada.';
  return t;
}