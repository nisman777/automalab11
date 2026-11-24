// Imán: busca el punto al que se "pega" el cursor (extremo, punto medio,
// intersección o grilla) y aplica el modo ortogonal.
import { segmentosDePolilinea, cajaDeArco, puntoEnArco, barrido } from './geometria.js';


// Separación de la grilla en metros: serie 1-2-5, con al menos 10 px entre líneas.
export function pasoGrilla(escala) {
  for (let k = -3; k <= 4; k++) {
    for (const m of [1, 2, 5]) {
      const paso = m * 10 ** k;
      if (paso * escala >= 10) return { paso, cada: m === 5 ? 2 : 5 };
    }
  }
  return { paso: 100000, cada: 5 };
}


const BONO = { extremo: 5, interseccion: 4, medio: 2 };   // prioridad, en píxeles
const limpiar = (n) => Math.round(n * 1e6) / 1e6;


function distSeg(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - s.x1) * dx + (py - s.y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}


function interseccion(a, b) {
  const rx = a.x2 - a.x1, ry = a.y2 - a.y1;
  const sx = b.x2 - b.x1, sy = b.y2 - b.y1;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;          // paralelas
  const qx = b.x1 - a.x1, qy = b.y1 - a.y1;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  const e = 1e-9;
  if (t < -e || t > 1 + e || u < -e || u > 1 + e) return null;
  return { x: a.x1 + t * rx, y: a.y1 + t * ry };
}


// Tramos rectos visibles de la planta: líneas, muros y los tramos de cada polilínea.
function segmentos(p, idPlanta) {
  const visibles = new Set(p.capas.filter((c) => c.visible !== false).map((c) => c.id));
  const r = [];
  for (const col of ['lineas', 'muros']) {
    for (const o of p[col]) if (o.planta === idPlanta && visibles.has(o.capa)) r.push(o);
  }
  for (const o of p.polilineas) {
    if (o.planta === idPlanta && visibles.has(o.capa)) r.push(...segmentosDePolilinea(o));
  }
  return r;
}


function arcosVisibles(p, idPlanta) {
  const visibles = new Set(p.capas.filter((c) => c.visible !== false).map((c) => c.id));
  return p.arcos.filter((a) => a.planta === idPlanta && visibles.has(a.capa));
}


// Devuelve { x, y, tipo } con tipo: extremo | medio | interseccion | grilla | libre.
// px, py: posición del cursor en píxeles. base: último punto fijado (para orto).
export function resolverPunto(p, vista, px, py, opc = {}) {
  const { objetos = true, grilla = true, orto = false, base = null, radio = 12 } = opc;
  const m = vista.aMundo(px, py);


  if (objetos) {
    const rm = radio / vista.escala;
    let mejor = null;
    const probar = (x, y, tipo) => {
      const d = Math.hypot(x - m.x, y - m.y) * vista.escala;
      if (d > radio) return;
      const puntaje = d - BONO[tipo];
      if (!mejor || puntaje < mejor.puntaje) mejor = { x, y, tipo, puntaje };
    };
    const cerca = [];
    for (const s of segmentos(p, p.ui.plantaActiva)) {
      if (Math.max(s.x1, s.x2) < m.x - rm || Math.min(s.x1, s.x2) > m.x + rm ||
          Math.max(s.y1, s.y2) < m.y - rm || Math.min(s.y1, s.y2) > m.y + rm) continue;
      probar(s.x1, s.y1, 'extremo');
      probar(s.x2, s.y2, 'extremo');
      probar((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, 'medio');
      if (cerca.length < 80 && distSeg(m.x, m.y, s) <= rm) cerca.push(s);
    }
    for (const a of arcosVisibles(p, p.ui.plantaActiva)) {
      const b = cajaDeArco(a);
      if (b.x1 < m.x - rm || b.x0 > m.x + rm || b.y1 < m.y - rm || b.y0 > m.y + rm) continue;
      const e1 = puntoEnArco(a, a.a1), e2 = puntoEnArco(a, a.a2);
      const md = puntoEnArco(a, a.a1 + barrido(a.a1, a.a2) / 2);
      probar(e1.x, e1.y, 'extremo');
      probar(e2.x, e2.y, 'extremo');
      probar(md.x, md.y, 'medio');
    }
    for (let i = 0; i < cerca.length; i++) {
      for (let j = i + 1; j < cerca.length; j++) {
        const q = interseccion(cerca[i], cerca[j]);
        if (q) probar(q.x, q.y, 'interseccion');
      }
    }
    if (mejor) return { x: limpiar(mejor.x), y: limpiar(mejor.y), tipo: mejor.tipo };
  }


  let x = m.x, y = m.y;
  let horizontal = null;
  if (orto && base) {
    horizontal = Math.abs(x - base.x) >= Math.abs(y - base.y);
    if (horizontal) y = base.y; else x = base.x;
  }
  if (grilla) {
    const paso = pasoGrilla(vista.escala).paso;
    const red = (n) => limpiar(Math.round(n / paso) * paso);
    if (horizontal !== false) x = red(x);
    if (horizontal !== true) y = red(y);
  }
  return { x: limpiar(x), y: limpiar(y), tipo: grilla ? 'grilla' : 'libre' };
}