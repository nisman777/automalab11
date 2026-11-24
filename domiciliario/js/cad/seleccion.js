// Selección de objetos de la planta activa: qué se puede elegir y cómo se busca.
// Este archivo solo lee el proyecto; no lo modifica.
import { distanciaAObjeto, cajaDeObjeto, cajaDentro, objetoTocaRect } from './geometria.js';


export const COLECCIONES_EDITABLES = ['lineas', 'polilineas', 'circulos', 'arcos', 'muros'];
export const clave = (col, id) => col + ':' + id;


// Objetos que se pueden elegir ahora: planta activa, capa visible y no bloqueada.
export function elegibles(p) {
  const capas = new Map(p.capas.map((c) => [c.id, c]));
  const activa = p.ui.plantaActiva;
  const lista = [];
  for (const col of COLECCIONES_EDITABLES) {
    for (const o of p[col]) {
      if (o.planta !== activa) continue;
      const c = capas.get(o.capa);
      if (c && (c.visible === false || c.bloqueada === true)) continue;
      lista.push({ col, id: o.id, k: clave(col, o.id), o });
    }
  }
  return lista;
}


// Objeto más cercano al punto (en píxeles), o null si no hay ninguno a tolerancia.
export function objetoEn(p, vista, px, py, tolerancia = 6) {
  const m = vista.aMundo(px, py);
  let mejor = null;
  let dMejor = Infinity;
  for (const h of elegibles(p)) {
    const o = h.o;
    const d = distanciaAObjeto(h.col, o, m.x, m.y) * vista.escala;
    const mitad = h.col === 'muros' ? ((o.espesor || 0) * vista.escala) / 2 : 0;
    if (d <= Math.max(tolerancia, mitad) && d < dMejor) {
      mejor = h;
      dMejor = d;
    }
  }
  return mejor;
}


// Selección por ventana (coordenadas en píxeles).
// De izquierda a derecha: solo lo que queda completamente adentro.
// De derecha a izquierda: todo lo que toca la ventana.
export function objetosEnVentana(p, vista, x0, y0, x1, y1) {
  const cruce = x1 < x0;
  const a = vista.aMundo(Math.min(x0, x1), Math.max(y0, y1));
  const b = vista.aMundo(Math.max(x0, x1), Math.min(y0, y1));
  const R = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  const res = [];
  for (const h of elegibles(p)) {
    const ok = cruce ? objetoTocaRect(h.col, h.o, R) : cajaDentro(cajaDeObjeto(h.col, h.o), R);
    if (ok) res.push(h);
  }
  return res;
}


// Objetos del proyecto que están en la selección (un Map clave → {col, id}).
export function objetosSeleccionados(p, seleccion) {
  const lista = [];
  for (const col of COLECCIONES_EDITABLES) {
    for (const o of p[col]) {
      if (seleccion.has(clave(col, o.id))) lista.push({ col, o });
    }
  }
  return lista;
}