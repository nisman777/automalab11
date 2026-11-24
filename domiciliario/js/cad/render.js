// Dibujo de la hoja: fondo, grilla, ejes, objetos, selección y vista previa.
// Solo dibuja; no modifica el proyecto.
import { pasoGrilla } from './snap.js';
import { COLECCIONES_EDITABLES } from './seleccion.js';
import { barrido, cajaDeObjeto, RAD } from './geometria.js';
import { camposTransformados } from './transformar.js';
import { todosLosTiradores } from './tiradores.js';


const FONDO = '#1b1b1c';
const GRILLA_FINA = '#2a2a2d';
const GRILLA_GRUESA = '#3a3a3e';
const COLOR_SEL = '#3d9bff';
const COLOR_HOVER = '#9fd0ff';
const COLOR_BORRAR = '#ff4d4d';
const COLOR_NUEVO = '#4cc978';
const COLOR_MEDIR = '#ffd400';


// Planta de abajo (la de mayor cota que sea menor a la activa), para usar de referencia.
export function plantaInferior(p, id) {
  const a = p.plantas.find((x) => x.id === id);
  if (!a) return null;
  let mejor = null;
  for (const q of p.plantas) {
    if (q.id !== id && q.cota < a.cota && (!mejor || q.cota > mejor.cota)) mejor = q;
  }
  return mejor;
}


// Caja que contiene todo lo dibujado y visible en una planta (o null si está vacía).
export function cajaDePlanta(p, id) {
  const capas = new Map(p.capas.map((c) => [c.id, c]));
  let c = null;
  const sumar = (x, y) => {
    if (!c) c = { x0: x, y0: y, x1: x, y1: y };
    else {
      c.x0 = Math.min(c.x0, x); c.y0 = Math.min(c.y0, y);
      c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y);
    }
  };
  for (const col of COLECCIONES_EDITABLES) {
    for (const o of p[col]) {
      if (o.planta !== id || capas.get(o.capa)?.visible === false) continue;
      const b = cajaDeObjeto(col, o);
      sumar(b.x0, b.y0);
      sumar(b.x1, b.y1);
    }
  }
  return c;
}


function dibujarGrilla(ctx, v) {
  const { paso, cada } = pasoGrilla(v.escala);
  const sup = v.aMundo(0, 0);
  const inf = v.aMundo(v.ancho, v.alto);
  const i0 = Math.floor(sup.x / paso), i1 = Math.ceil(inf.x / paso);
  const j0 = Math.floor(inf.y / paso), j1 = Math.ceil(sup.y / paso);
  if (i1 - i0 > 1500 || j1 - j0 > 1500) return;


  const fina = new Path2D();
  const gruesa = new Path2D();
  for (let i = i0; i <= i1; i++) {
    const px = Math.round(v.ox + i * paso * v.escala) + 0.5;
    const ruta = i % cada === 0 ? gruesa : fina;
    ruta.moveTo(px, 0); ruta.lineTo(px, v.alto);
  }
  for (let j = j0; j <= j1; j++) {
    const py = Math.round(v.oy - j * paso * v.escala) + 0.5;
    const ruta = j % cada === 0 ? gruesa : fina;
    ruta.moveTo(0, py); ruta.lineTo(v.ancho, py);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = GRILLA_FINA;
  ctx.stroke(fina);
  ctx.strokeStyle = GRILLA_GRUESA;
  ctx.stroke(gruesa);
}


function dibujarEjes(ctx, v) {
  const o = v.aPantalla(0, 0);
  ctx.lineWidth = 1;
  if (o.y >= 0 && o.y <= v.alto) {
    ctx.strokeStyle = '#7a3b3b';
    ctx.beginPath(); ctx.moveTo(0, Math.round(o.y) + 0.5); ctx.lineTo(v.ancho, Math.round(o.y) + 0.5); ctx.stroke();
  }
  if (o.x >= 0 && o.x <= v.ancho) {
    ctx.strokeStyle = '#3b7a5a';
    ctx.beginPath(); ctx.moveTo(Math.round(o.x) + 0.5, 0); ctx.lineTo(Math.round(o.x) + 0.5, v.alto); ctx.stroke();
  }
}


// Arma el contorno de un muro (rectángulo) como camino actual. false si mide cero.
function trazarMuro(ctx, v, x1, y1, x2, y2, espesor) {
  const a = v.aPantalla(x1, y1), b = v.aPantalla(x2, y2);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const h = Math.max((espesor * v.escala) / 2, 0.75);
  const nx = (-dy / len) * h, ny = (dx / len) * h;
  ctx.beginPath();
  ctx.moveTo(a.x + nx, a.y + ny);
  ctx.lineTo(b.x + nx, b.y + ny);
  ctx.lineTo(b.x - nx, b.y - ny);
  ctx.lineTo(a.x - nx, a.y - ny);
  ctx.closePath();
  return true;
}


// Camino de cualquier objeto (con desplazamiento opcional).
// false si no hay nada que trazar.
function trazarContorno(ctx, v, col, o, dx = 0, dy = 0) {
  switch (col) {
    case 'muros':
      return trazarMuro(ctx, v, o.x1 + dx, o.y1 + dy, o.x2 + dx, o.y2 + dy, o.espesor);
    case 'polilineas': {
      if (!o.puntos || o.puntos.length < 2) return false;
      ctx.beginPath();
      o.puntos.forEach((q, i) => {
        const s = v.aPantalla(q.x + dx, q.y + dy);
        if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
      });
      if (o.cerrada) ctx.closePath();
      return true;
    }
    case 'circulos': {
      const r = o.r * v.escala;
      if (!(r > 0.2)) return false;
      const c = v.aPantalla(o.cx + dx, o.cy + dy);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      return true;
    }
    case 'arcos': {
      const r = o.r * v.escala;
      if (!(r > 0.2)) return false;
      const c = v.aPantalla(o.cx + dx, o.cy + dy);
      // En pantalla el eje Y está invertido: el sentido antihorario del dibujo es "anticlockwise" con el ángulo cambiado de signo.
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, -o.a1 * RAD, -(o.a1 + barrido(o.a1, o.a2)) * RAD, true);
      return true;
    }
    default: {
      const a = v.aPantalla(o.x1 + dx, o.y1 + dy), b = v.aPantalla(o.x2 + dx, o.y2 + dy);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      return true;
    }
  }
}


function dibujarObjetos(ctx, v, p, idPlanta, tenue) {
  const capas = new Map(p.capas.map((c) => [c.id, c]));
  const base = tenue ? 0.28 : 1;
  const visible = (o) => capas.get(o.capa)?.visible !== false;
  const color = (o) => (tenue ? '#9a9a9a' : capas.get(o.capa)?.color ?? '#ffffff');


  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';


  for (const m of p.muros) {
    if (m.planta !== idPlanta || !visible(m)) continue;
    if (!trazarMuro(ctx, v, m.x1, m.y1, m.x2, m.y2, m.espesor)) continue;
    ctx.fillStyle = color(m);
    ctx.globalAlpha = base * 0.35;
    ctx.fill();
    ctx.strokeStyle = color(m);
    ctx.globalAlpha = base;
    ctx.lineWidth = 1;
    ctx.stroke();
  }


  ctx.lineWidth = 1;
  ctx.globalAlpha = base;
  for (const col of ['lineas', 'polilineas', 'circulos', 'arcos']) {
    for (const o of p[col]) {
      if (o.planta !== idPlanta || !visible(o)) continue;
      if (!trazarContorno(ctx, v, col, o)) continue;
      ctx.strokeStyle = color(o);
      ctx.stroke();
    }
  }
  ctx.restore();
}


// Resalta objetos de la planta activa (seleccionados o bajo el cursor).
// claves: Map o Set con claves "coleccion:id".
function dibujarResaltado(ctx, v, p, claves, { color, ancho, guion, relleno }) {
  ctx.save();
  ctx.lineJoin = 'round';
  for (const col of COLECCIONES_EDITABLES) {
    for (const o of p[col]) {
      if (o.planta !== p.ui.plantaActiva || !claves.has(col + ':' + o.id)) continue;
      if (!trazarContorno(ctx, v, col, o)) continue;
      if (relleno && col === 'muros') {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.setLineDash(guion);
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho;
      ctx.stroke();
    }
  }
  ctx.restore();
}


// Los cuadraditos de los objetos elegidos: azul normal, naranja bajo el cursor, rojo el que se está moviendo.
// tiradores = { claves, caliente: {k, idx} | null, activo: {k, idx} | null }
function dibujarTiradores(ctx, v, p, { claves, caliente, activo }) {
  const lista = todosLosTiradores(p, claves);
  if (!lista.length) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  const h = 4;
  for (const g of lista) {
    const s = v.aPantalla(g.x, g.y);
    if (s.x < -10 || s.y < -10 || s.x > v.ancho + 10 || s.y > v.alto + 10) continue;
    const esActivo = activo && activo.k === g.k && activo.idx === g.idx;
    const esCaliente = caliente && caliente.k === g.k && caliente.idx === g.idx;
    ctx.fillStyle = esActivo ? '#ff4d4d' : esCaliente ? '#ff9f1c' : COLOR_SEL;
    ctx.strokeStyle = '#101010';
    const x = Math.round(s.x) - h;
    const y = Math.round(s.y) - h;
    ctx.fillRect(x, y, 2 * h + 1, 2 * h + 1);
    ctx.strokeRect(x + 0.5, y + 0.5, 2 * h, 2 * h);
  }
  ctx.restore();
}


// Vista previa de mover, copiar, rotar, escalar, espejar, alinear y matrices:
// los objetos elegidos, ya transformados con T (o con cada T de Ts), en línea punteada.
function dibujarFantasma(ctx, v, p, { claves, T, Ts }) {
  const lista = [];
  for (const col of COLECCIONES_EDITABLES) {
    for (const o of p[col]) {
      if (o.planta !== p.ui.plantaActiva || !claves.has(col + ':' + o.id)) continue;
      lista.push({ col, o });
    }
  }
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  for (const Tx of Ts ?? [T]) {
    for (const { col, o } of lista) {
      const nuevo = { ...o, ...camposTransformados(col, o, Tx) };
      if (!trazarContorno(ctx, v, col, nuevo)) continue;
      ctx.stroke();
    }
  }
  ctx.restore();
}


// Vista previa de un tirador: el objeto con los campos nuevos, en línea punteada.
// estirar = { col, id, campos }
function dibujarEstirar(ctx, v, p, { col, id, campos }) {
  const o = p[col].find((x) => x.id === id);
  if (!o) return;
  const nuevo = { ...o, ...campos };
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  if (trazarContorno(ctx, v, col, nuevo)) ctx.stroke();
  ctx.restore();
}


// Vista previa de Borrar tramo, Partir y Agregar vértice:
// el objeto bajo el cursor resaltado, el tramo que se borraría en rojo y el punto de corte con una X.
// corte = { objeto: clave | null, tramo: { col, datos } | null, punto: { x, y } | null }
function dibujarCorte(ctx, v, p, { objeto, tramo, punto }) {
  if (objeto) dibujarResaltado(ctx, v, p, new Set([objeto]), { color: COLOR_HOVER, ancho: 1.5, guion: [], relleno: false });
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (tramo && trazarContorno(ctx, v, tramo.col, tramo.datos)) {
    if (tramo.col === 'muros') {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = COLOR_BORRAR;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = COLOR_BORRAR;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (punto) {
    const s = v.aPantalla(punto.x, punto.y);
    const h = 6;
    ctx.setLineDash([]);
    ctx.strokeStyle = COLOR_BORRAR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x - h, s.y - h); ctx.lineTo(s.x + h, s.y + h);
    ctx.moveTo(s.x + h, s.y - h); ctx.lineTo(s.x - h, s.y + h);
    ctx.stroke();
  }
  ctx.restore();
}


// Pinta una figura { col, datos } con un color (los muros, también rellenos).
function pintarFigura(ctx, v, fig, color, ancho) {
  if (!trazarContorno(ctx, v, fig.col, fig.datos)) return;
  if (fig.col === 'muros') {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.lineWidth = ancho;
  ctx.stroke();
}


// Vista previa de Extender, Empalme, Chaflán y Desfase:
// objetos resaltados, lo que se saca en rojo, lo nuevo en verde y marcas circulares.
// obra = { resaltar: [claves], nuevos: [{ col, datos }], quitar: [{ col, datos }], marcas: [{ x, y }] }
function dibujarObra(ctx, v, p, { resaltar, nuevos, quitar, marcas }) {
  if (resaltar && resaltar.length) {
    dibujarResaltado(ctx, v, p, new Set(resaltar), { color: COLOR_HOVER, ancho: 1.5, guion: [], relleno: false });
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const f of quitar ?? []) pintarFigura(ctx, v, f, COLOR_BORRAR, 3);
  for (const f of nuevos ?? []) pintarFigura(ctx, v, f, COLOR_NUEVO, 2);
  ctx.setLineDash([]);
  ctx.strokeStyle = COLOR_NUEVO;
  ctx.lineWidth = 1.5;
  for (const m of marcas ?? []) {
    const s = v.aPantalla(m.x, m.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}


// Cartelito de texto amarillo centrado sobre un punto del dibujo.
function dibujarEtiqueta(ctx, v, x, y, texto) {
  const s = v.aPantalla(x, y);
  ctx.font = '12px Consolas, "Courier New", monospace';
  const w = ctx.measureText(texto).width;
  const tx = Math.max(4, Math.min(s.x - w / 2, v.ancho - w - 12));
  const ty = Math.max(16, Math.min(s.y - 8, v.alto - 8));
  ctx.fillStyle = 'rgba(30,30,30,0.88)';
  ctx.fillRect(tx - 4, ty - 12, w + 8, 18);
  ctx.fillStyle = COLOR_MEDIR;
  ctx.fillText(texto, tx, ty + 1);
}


// Distancia y Área: líneas, contorno, círculo, puntos y textos de la medición.
// medicion = { resaltar: [claves], poligono: [{x,y}] | null, cerrado, relleno, circulo: {cx,cy,r} | null,
//              lineas: [{ a, b, guion }], puntos: [{x,y}], textos: [{ x, y, t }] }
function dibujarMedicion(ctx, v, p, m) {
  if (m.resaltar && m.resaltar.length) {
    dibujarResaltado(ctx, v, p, new Set(m.resaltar), { color: COLOR_HOVER, ancho: 1.5, guion: [], relleno: false });
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLOR_MEDIR;
  ctx.fillStyle = COLOR_MEDIR;
  if (m.poligono && m.poligono.length >= 2) {
    ctx.beginPath();
    m.poligono.forEach((q, i) => {
      const s = v.aPantalla(q.x, q.y);
      if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
    });
    if (m.cerrado) ctx.closePath();
    if (m.relleno && m.cerrado) {
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (m.circulo) {
    const c = v.aPantalla(m.circulo.cx, m.circulo.cy);
    ctx.beginPath();
    ctx.arc(c.x, c.y, m.circulo.r * v.escala, 0, Math.PI * 2);
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const l of m.lineas ?? []) {
    const a = v.aPantalla(l.a.x, l.a.y), b = v.aPantalla(l.b.x, l.b.y);
    ctx.setLineDash(l.guion ? [5, 4] : []);
    ctx.lineWidth = l.guion ? 1 : 1.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const q of m.puntos ?? []) {
    const s = v.aPantalla(q.x, q.y);
    ctx.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 3, 7, 7);
  }
  for (const t of m.textos ?? []) dibujarEtiqueta(ctx, v, t.x, t.y, t.t);
  ctx.restore();
}


// Ventana de selección: azul y continua (de izquierda a derecha), verde y punteada (de derecha a izquierda).
function dibujarVentana(ctx, w) {
  const cruce = w.x1 < w.x0;
  const x = Math.min(w.x0, w.x1), y = Math.min(w.y0, w.y1);
  const ancho = Math.abs(w.x1 - w.x0), alto = Math.abs(w.y1 - w.y0);
  ctx.save();
  ctx.fillStyle = cruce ? 'rgba(76,201,120,0.14)' : 'rgba(61,155,255,0.14)';
  ctx.fillRect(x, y, ancho, alto);
  ctx.strokeStyle = cruce ? '#4cc978' : COLOR_SEL;
  ctx.lineWidth = 1;
  ctx.setLineDash(cruce ? [6, 4] : []);
  ctx.strokeRect(x + 0.5, y + 0.5, ancho, alto);
  ctx.restore();
}


const ETIQUETAS = { extremo: 'Extremo', medio: 'Punto medio', interseccion: 'Intersección' };


// Marca amarilla del imán: cuadrado = extremo, triángulo = medio, X = intersección, + = grilla.
function dibujarMarca(ctx, v, m) {
  if (m.tipo === 'libre') return;
  const p = v.aPantalla(m.x, m.y);
  const s = 6;
  ctx.save();
  ctx.strokeStyle = '#ffd400';
  ctx.fillStyle = '#ffd400';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (m.tipo === 'extremo') {
    ctx.rect(p.x - s, p.y - s, 2 * s, 2 * s);
  } else if (m.tipo === 'medio') {
    ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y + s); ctx.lineTo(p.x - s, p.y + s); ctx.closePath();
  } else if (m.tipo === 'interseccion') {
    ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s);
    ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s);
  } else {
    ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y);
    ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4);
  }
  ctx.stroke();
  if (ETIQUETAS[m.tipo]) {
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(ETIQUETAS[m.tipo], p.x + s + 4, p.y - s - 2);
  }
  ctx.restore();
}


// Vista previa: la figura en curso, guías, medida junto al cursor y marca del imán.
// pr = { forma: { col, datos } | null, guias: [{ a, b }], texto, marca }
function dibujarPrevia(ctx, v, pr) {
  const { forma, guias, texto, marca } = pr;
  ctx.save();
  ctx.lineJoin = 'round';
  if (forma) {
    const d = forma.datos;
    if (forma.col === 'muros') {
      if (trazarMuro(ctx, v, d.x1, d.y1, d.x2, d.y2, d.espesor)) {
        ctx.fillStyle = '#e6e6e6';
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (trazarContorno(ctx, v, 'lineas', d)) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (trazarContorno(ctx, v, forma.col, d)) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if (guias && guias.length) {
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 1;
    for (const g of guias) {
      const a = v.aPantalla(g.a.x, g.a.y), b = v.aPantalla(g.b.x, g.b.y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  if (texto && marca) {
    const b = v.aPantalla(marca.x, marca.y);
    ctx.font = '12px Consolas, "Courier New", monospace';
    const w = ctx.measureText(texto).width;
    const tx = Math.max(4, Math.min(b.x + 16, v.ancho - w - 12));
    const ty = Math.max(16, Math.min(b.y - 16, v.alto - 8));
    ctx.fillStyle = 'rgba(30,30,30,0.88)';
    ctx.fillRect(tx - 4, ty - 12, w + 8, 18);
    ctx.fillStyle = '#ffd400';
    ctx.fillText(texto, tx, ty + 1);
  }
  if (marca) dibujarMarca(ctx, v, marca);
  ctx.restore();
}


// Iconito de ejes X/Y abajo a la izquierda, como en AutoCAD.
function dibujarIconoEjes(ctx, v) {
  const x = 36, y = v.alto - 36, L = 28;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.strokeStyle = ctx.fillStyle = '#f14c4c';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y); ctx.stroke();
  ctx.fillText('X', x + L + 4, y + 4);
  ctx.strokeStyle = ctx.fillStyle = '#4ec9b0';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - L); ctx.stroke();
  ctx.fillText('Y', x - 3, y - L - 5);
  ctx.restore();
}


// opciones: grilla, previa, seleccion (Map de claves), hover (clave), fantasma ({claves, T} o {claves, Ts}),
// tiradores ({claves, caliente, activo}), estirar ({col, id, campos}), ventana ({x0,y0,x1,y1} en px),
// corte ({objeto, tramo, punto}), obra ({resaltar, nuevos, quitar, marcas}), medicion (ver dibujarMedicion)
export function dibujar(ctx, v, p, {
  grilla = true, previa = null, seleccion = null, hover = null, fantasma = null,
  tiradores = null, estirar = null, ventana = null, corte = null, obra = null, medicion = null,
} = {}) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, v.ancho + 1, v.alto + 1);
  if (grilla) dibujarGrilla(ctx, v);
  dibujarEjes(ctx, v);
  const activa = p.ui.plantaActiva;
  const inf = plantaInferior(p, activa);
  if (inf) dibujarObjetos(ctx, v, p, inf.id, true);
  dibujarObjetos(ctx, v, p, activa, false);
  if (seleccion && seleccion.size) {
    dibujarResaltado(ctx, v, p, seleccion, { color: COLOR_SEL, ancho: 1.5, guion: [6, 4], relleno: true });
  }
  if (hover && !(seleccion && seleccion.has(hover))) {
    dibujarResaltado(ctx, v, p, new Set([hover]), { color: COLOR_HOVER, ancho: 2, guion: [], relleno: false });
  }
  if (tiradores) dibujarTiradores(ctx, v, p, tiradores);
  if (fantasma) dibujarFantasma(ctx, v, p, fantasma);
  if (estirar) dibujarEstirar(ctx, v, p, estirar);
  if (corte) dibujarCorte(ctx, v, p, corte);
  if (obra) dibujarObra(ctx, v, p, obra);
  if (medicion) dibujarMedicion(ctx, v, p, medicion);
  if (previa) dibujarPrevia(ctx, v, previa);
  if (ventana) dibujarVentana(ctx, ventana);
  dibujarIconoEjes(ctx, v);
}