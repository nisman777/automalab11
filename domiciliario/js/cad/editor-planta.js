import { el } from '../ui/dom.js';
import { Vista } from './vista.js';
import { dibujar, cajaDePlanta, plantaInferior } from './render.js';
import { resolverPunto } from './snap.js';
import { crearDibujo, interpretarPunto } from './dibujo.js';
import { crearBarraComandos } from './barra-comandos.js';
import { crearMenus, etiqueta, separadorMenu, notaMenu } from './barra-herramientas.js';
import { elegibles, objetoEn, objetosEnVentana, objetosSeleccionados } from './seleccion.js';
import { moverObjetos, copiarObjetos, repetirObjetos, borrarObjetos, cambiarCapaObjetos, transformarObjetos, modificarObjeto, aplicarCorte, aplicarObra } from './edicion.js';
import { traslacion, rotacion, escalado, reflexion, alineacion, errorDeTransformacion } from './transformar.js';
import { tiradorEn, camposPorTirador, textoTirador } from './tiradores.js';
import { planDeTramo, planDePartir, planDeVertice, objetoCercano } from './cortes.js';
import { planDeExtender, planDeEsquina, planDeDesfase } from './construccion.js';
import { planDeMatrizRect, planDeMatrizPolar, datosDeDistancia, textoDistancia, resumenDeArea, areaDeObjeto, textoArea } from './medicion.js';
import { crearPanelCapas } from './panel-capas.js';
import { textoMedida, distanciaAObjeto, RAD } from './geometria.js';
import { toast } from '../ui/dialogos.js';
const num = (n, dec) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const libre = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });
const ALIAS = {
  L: 'linea', LINEA: 'linea', 'LÍNEA': 'linea',
  MU: 'muro', MURO: 'muro',
  PL: 'polilinea', POL: 'polilinea', POLILINEA: 'polilinea', 'POLILÍNEA': 'polilinea',
  REC: 'rectangulo', RECT: 'rectangulo', RECTANGULO: 'rectangulo', 'RECTÁNGULO': 'rectangulo',
  CI: 'circulo', CIRC: 'circulo', CIRCULO: 'circulo', 'CÍRCULO': 'circulo',
  A: 'arco', ARCO: 'arco',
  ARCOC: 'arcoc', ARCOCENTRO: 'arcoc',
};
const ALIAS_EDICION = {
  M: 'mover', MOVER: 'mover',
  CP: 'copiar', CO: 'copiar', COPIAR: 'copiar',
  RO: 'rotar', ROTAR: 'rotar',
  ES: 'espejo', MI: 'espejo', ESPEJO: 'espejo',
  EC: 'escala', SC: 'escala', ESCALA: 'escala', ESCALAR: 'escala',
  AL: 'alinear', ALINEAR: 'alinear',
  MR: 'matrizr', MATRIZ: 'matrizr', MATRIZR: 'matrizr', MATRIZRECT: 'matrizr',
  MP: 'matrizp', MATRIZP: 'matrizp', MATRIZPOLAR: 'matrizp',
  B: 'borrar', BORRAR: 'borrar', ELIMINAR: 'borrar', SUPR: 'borrar',
};
const ALIAS_CORTE = {
  BT: 'tramo', TR: 'tramo', RECORTAR: 'tramo', BORRARTRAMO: 'tramo',
  PA: 'partir', PARTIR: 'partir',
  AV: 'vertice', VERTICE: 'vertice', 'VÉRTICE': 'vertice',
};
const ALIAS_OBRA = {
  EX: 'extender', EXTENDER: 'extender',
  EM: 'empalme', EMPALME: 'empalme',
  CH: 'chaflan', CHAFLAN: 'chaflan', 'CHAFLÁN': 'chaflan',
  DF: 'desfase', DESFASE: 'desfase', DESFASAR: 'desfase', OFFSET: 'desfase',
};
const ALIAS_MEDIR = {
  DI: 'distancia', DIST: 'distancia', DISTANCIA: 'distancia',
  AR: 'area', AREA: 'area', 'ÁREA': 'area',
};
const NOMBRE_ED = {
  mover: 'MOVER', copiar: 'COPIAR', rotar: 'ROTAR', espejo: 'ESPEJO', escala: 'ESCALA', alinear: 'ALINEAR',
  matrizr: 'MATRIZ RECTANGULAR', matrizp: 'MATRIZ POLAR',
};
const COMANDO_ED = { mover: 'M', copiar: 'CP', rotar: 'RO', espejo: 'ES', escala: 'EC', alinear: 'AL', matrizr: 'MR', matrizp: 'MP' };
const FASE_INICIAL = { mover: 'base', copiar: 'base', rotar: 'base', escala: 'base', espejo: 'p1', alinear: 's1', matrizr: 'filas', matrizp: 'centro' };
const NOMBRE_CORTE = { tramo: 'Borrar tramo', partir: 'Partir', vertice: 'Agregar vértice' };
const TEXTO_CORTE = {
  tramo: 'BORRAR TRAMO — Clic sobre el pedazo que querés borrar (se borra hasta el cruce más cercano de cada lado; lo ves en rojo). Esc termina:',
  partir: 'PARTIR — Clic en el punto donde querés cortar el objeto (el imán ayuda con medios y cruces). Esc termina:',
  vertice: 'AGREGAR VÉRTICE — Clic sobre la polilínea, en el punto donde va el vértice nuevo. Esc termina:',
};
const NOMBRE_OBRA = { extender: 'Extender', empalme: 'Empalme', chaflan: 'Chaflán', desfase: 'Desfase' };
// Qué objetos se pueden tocar en cada herramienta (null = todos los editables).
const COLUMNAS_OBRA = { extender: ['lineas', 'muros', 'arcos'], empalme: ['lineas', 'muros'], chaflan: ['lineas', 'muros'], desfase: null };
const pl = (n, uno, varios) => (n === 1 ? uno : varios);
const objs = (n) => `${n} objeto${n === 1 ? '' : 's'}`;
const lineaEntre = (a, b) => ({ col: 'lineas', datos: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } });
const igualPunto = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;
const redondear = (n) => Math.round(n * 1e6) / 1e6;
// Ángulo (0 a 360, antihorario, 0 = Este) desde el punto a hacia el punto b.
const anguloHacia = (a, b) => redondear((((Math.atan2(b.y - a.y, b.x - a.x) / RAD) % 360) + 360) % 360);
const promedio = (pts) => ({
  x: pts.reduce((s, q) => s + q.x, 0) / pts.length,
  y: pts.reduce((s, q) => s + q.y, 0) / pts.length,
});
// Pestaña "Planta": hoja de dibujo, menús de herramientas (dibujar, modificar, construir, medir),
// selección, tiradores, mover, copiar, rotar, espejo, escala, alinear, matrices, borrar, borrar tramo, partir,
// agregar vértice, extender, empalme, chaflán, desfase, distancia, área, capas, imán, orto,
// barra de estado y barra de comandos.
export function montarPlanta(contenedor, sesion) {
  const proy = () => sesion.historial.proyecto;
  const vista = new Vista();
  const canvas = el('canvas', { tabIndex: 0 });
  const ctx = canvas.getContext('2d');
  const lienzo = el('div', { class: 'cad-lienzo' }, canvas);
  // Menús desplegables de la barra superior (al elegir una herramienta el foco vuelve a la hoja).
  const menus = crearMenus({ alElegir: () => canvas.focus() });
  // ---- Estado de edición (se declara arriba a propósito) ----
  const seleccion = new Map();   // clave "coleccion:id" → { col, id }
  let hover = null;              // clave del objeto bajo el cursor
  let caliente = null;           // tirador bajo el cursor: { k, idx }
  // { tipo, fase, base, copias, pts: [puntos fijados], copiar: bool, T: transformación ya fijada, grip: tirador agarrado, par: datos de las matrices }
  let edicion = null;
  // Borrar tramo, Partir o Agregar vértice: { tipo: 'tramo'|'partir'|'vertice', plan: lo que se haría con el clic }
  let corte = null;
  // Extender, Empalme, Chaflán o Desfase: { tipo, fase: 'uno'|'dos'|'lado', a: primer objeto elegido, plan }
  let obra = null;
  // Distancia o Área: { tipo: 'distancia'|'area', fase: 'puntos'|'objeto', pts: [puntos], res: resultado | null, h: objeto bajo el cursor }
  let medir = null;
  // Medidas que se recuerdan entre usos
  const ajustes = {
    radio: 0, d1: 0.5, d2: 0.5, desfase: 0.15,
    filas: 2, cols: 2, sepf: 3, sepc: 3, cant: 6, ang: 360, gira: true,
  };
  let arrastre = null;           // clic o ventana de selección en curso
  let ultimaHerr = null;
  // ---- Controles de la barra superior ----
  const selPlanta = el('select', { title: 'Planta activa' });
  const casilla = (marcada) => el('input', { type: 'checkbox', checked: marcada });
  const chkGrilla = casilla(true);
  const chkIman = casilla(true);
  const chkImanGrilla = casilla(true);
  const chkOrto = casilla(false);
  const inpEspesor = el('input', { type: 'number', step: 0.01, min: 0.01, max: 2, value: 0.15, title: 'Espesor de los muros nuevos, en metros' });
  // El espesor solo se muestra mientras está activa la herramienta Muro.
  const lblEspesor = el('label', {}, 'Espesor muro', inpEspesor, 'm');
  lblEspesor.hidden = true;
  const botonesHerr = {};   // herramienta → botón
  const botonHerr = (clave, texto, atajo, titulo) => {
    const b = el('button', { type: 'button', class: 'btn', title: titulo, onclick: () => elegir(clave) }, ...etiqueta(texto, atajo));
    botonesHerr[clave] = b;
    return b;
  };
  const btnLinea = botonHerr('linea', 'Línea', 'L', 'Dibujar líneas (L)');
  const btnPolilinea = botonHerr('polilinea', 'Polilínea', 'PL', 'Polilínea: varios tramos en una sola figura (PL)');
  const btnRect = botonHerr('rectangulo', 'Rectángulo', 'REC', 'Rectángulo por dos esquinas (REC)');
  const btnCirculo = botonHerr('circulo', 'Círculo', 'CI', 'Círculo por centro y radio (CI)');
  const btnArco = botonHerr('arco', 'Arco', 'A', 'Arco por tres puntos (A)');
  const btnArcoC = botonHerr('arcoc', 'Arco C', 'ARCOC', 'Arco por centro, inicio y fin, en sentido antihorario (ARCOC)');
  const btnMuro = botonHerr('muro', 'Muro', 'MU', 'Dibujar muros (MU)');
  const botonesEd = {};   // tipo de edición → botón (se habilitan al haber objetos elegidos)
  const botonEd = (tipo, texto, atajo, titulo) => {
    const b = el('button', { type: 'button', class: 'btn', title: titulo, onclick: () => iniciarEdicion(tipo) }, ...etiqueta(texto, atajo));
    b.disabled = true;
    botonesEd[tipo] = b;
    return b;
  };
  const btnMover = botonEd('mover', 'Mover', 'M', 'Mover los objetos elegidos (M)');
  const btnCopiar = botonEd('copiar', 'Copiar', 'CP', 'Copiar los objetos elegidos (CP)');
  const btnRotar = botonEd('rotar', 'Rotar', 'RO', 'Rotar los objetos elegidos (RO)');
  const btnEspejo = botonEd('espejo', 'Espejo', 'ES', 'Espejo respecto de un eje de dos puntos (ES)');
  const btnEscala = botonEd('escala', 'Escala', 'EC', 'Cambiar el tamaño de los objetos elegidos (EC)');
  const btnAlinear = botonEd('alinear', 'Alinear', 'AL', 'Alinear los objetos con uno o dos pares de puntos (AL)');
  const btnMatrizR = botonEd('matrizr', 'Matriz rectangular', 'MR', 'Matriz rectangular: repetir lo elegido en filas y columnas (MR)');
  const btnMatrizP = botonEd('matrizp', 'Matriz polar', 'MP', 'Matriz polar: repetir lo elegido alrededor de un centro (MP)');
  const botonesCorte = {};   // tipo de corte → botón (no necesitan selección)
  const botonCorte = (tipo, texto, atajo, titulo) => {
    const b = el('button', { type: 'button', class: 'btn', title: titulo, onclick: () => iniciarCorte(tipo) }, ...etiqueta(texto, atajo));
    botonesCorte[tipo] = b;
    return b;
  };
  const btnTramo = botonCorte('tramo', 'Borrar tramo', 'BT', 'Borrar solo el pedazo que tocás, hasta el cruce más cercano de cada lado (BT)');
  const btnPartir = botonCorte('partir', 'Partir', 'PA', 'Cortar un objeto en un punto, en dos partes (PA)');
  const btnVertice = botonCorte('vertice', 'Agregar vértice', 'AV', 'Agregar un vértice a una polilínea (AV)');
  const botonesObra = {};   // tipo de obra → botón (no necesitan selección)
  const botonObra = (tipo, texto, atajo, titulo) => {
    const b = el('button', { type: 'button', class: 'btn', title: titulo, onclick: () => iniciarObra(tipo) }, ...etiqueta(texto, atajo));
    botonesObra[tipo] = b;
    return b;
  };
  const btnExtender = botonObra('extender', 'Extender', 'EX', 'Alargar una línea, muro o arco hasta el primer objeto que encuentre (EX)');
  const btnEmpalme = botonObra('empalme', 'Empalme', 'EM', 'Unir dos líneas o muros en una esquina; con radio, redondeada (EM)');
  const btnChaflan = botonObra('chaflan', 'Chaflán', 'CH', 'Cortar la esquina de dos líneas con un tramo recto (CH)');
  const btnDesfase = botonObra('desfase', 'Desfase', 'DF', 'Copia paralela a una distancia (DF)');
  const botonesMedir = {};   // tipo de medición → botón (no necesitan selección)
  const botonMedir = (tipo, texto, atajo, titulo) => {
    const b = el('button', { type: 'button', class: 'btn', title: titulo, onclick: () => iniciarMedir(tipo) }, ...etiqueta(texto, atajo));
    botonesMedir[tipo] = b;
    return b;
  };
  const btnDistancia = botonMedir('distancia', 'Distancia', 'DI', 'Medir la distancia entre dos puntos (DI)');
  const btnArea = botonMedir('area', 'Área', 'AR', 'Medir el área y el perímetro de un contorno (AR)');
  const btnBorrar = el('button', { type: 'button', class: 'btn', title: 'Borrar los objetos elegidos (Supr)', onclick: () => { borrarSeleccion(); canvas.focus(); } }, ...etiqueta('Borrar', 'Supr'));
  const btnEncuadrar = el('button', { type: 'button', class: 'btn', title: 'Mostrar todo el dibujo', onclick: () => encuadrar() }, 'Encuadrar');
  const btnCapas = el('button', { type: 'button', class: 'btn activa', title: 'Mostrar u ocultar el panel de capas (CAPAS)', onclick: () => { alternarPanelCapas(); canvas.focus(); } }, 'Capas');
  btnBorrar.disabled = true;
  const lblCoord = el('span', { class: 'coord' }, 'X: —   Y: —');
  const lblZoom = el('span', {});
  const lblRef = el('span', {});
  const lblSel = el('span', { class: 'sel' });
  const leerEspesor = () => {
    const v = Number(inpEspesor.value);
    return Number.isFinite(v) && v >= 0.01 && v <= 2 ? v : 0.15;
  };
  // ---- Barra de comandos y herramienta de dibujo ----
  const barra = crearBarraComandos({
    alEnviar: (t) => ejecutar(t),
    alEscape: () => cancelarTodo(),
    alDeshacer: () => sesion.historial.deshacer(),
    alRehacer: () => sesion.historial.rehacer(),
  });
  // ---- Mostrar u ocultar la barra de comandos ----
  const CLAVE_BARRA = 'automalab_dom_barra_oculta';
  let barraOculta = false;
  try { barraOculta = localStorage.getItem(CLAVE_BARRA) === '1'; } catch { /* sin acceso */ }
  // Si la barra está oculta, los errores salen también como aviso flotante.
  const mensajeEnBarra = barra.mensaje;
  barra.mensaje = (t, tipo) => {
    mensajeEnBarra(t, tipo);
    if (barraOculta && tipo === 'error') toast(t, 'error');
  };
  const btnBarra = el('button', { type: 'button', class: 'btn-barra', onclick: () => { alternarBarra(); canvas.focus(); } });
  function alternarBarra(oculta = !barraOculta) {
    barraOculta = oculta;
    barra.elemento.hidden = oculta;
    btnBarra.textContent = oculta ? '▲ Comandos' : '▼ Comandos';
    btnBarra.title = oculta ? 'Mostrar la barra de comandos' : 'Ocultar la barra de comandos';
    try { localStorage.setItem(CLAVE_BARRA, oculta ? '1' : '0'); } catch { /* sin acceso */ }
  }
  alternarBarra(barraOculta);
  const dibujo = crearDibujo({
    sesion,
    mensaje: (t, tipo) => barra.mensaje(t, tipo),
    indicar: (t) => barra.indicar(t),
    alCambiar: () => {
      if (dibujo.herramienta) ultimaHerr = dibujo.herramienta;
      for (const [k, b] of Object.entries(botonesHerr)) b.classList.toggle('activa', dibujo.herramienta === k);
      lblEspesor.hidden = dibujo.herramienta !== 'muro';
      menus.actualizar();
      pedirDibujo();
    },
    leerEspesor,
  });
  // ---- Panel de capas ----
  const panelCapas = crearPanelCapas({
    sesion,
    mensaje: (t, tipo) => barra.mensaje(t, tipo),
    alCambiar: () => { depurarSeleccion(); recalcular(); },
    asignar: (idCapa) => { asignarCapa(idCapa); canvas.focus(); },
  });
  function alternarPanelCapas() {
    const v = panelCapas.mostrarOcultar();
    btnCapas.classList.toggle('activa', v);
  }
  // Elegir una herramienta de dibujo (sale de la edición en curso y deja sin selección).
  function iniciarDibujo(clave) {
    if (edicion) terminarEdicion();
    if (corte) terminarCorte();
    if (obra) terminarObra();
    if (medir) terminarMedir();
    limpiarSeleccion();
    dibujo.elegir(clave);
    recalcular();
  }
  function elegir(clave) {
    iniciarDibujo(clave);
    canvas.focus();
  }
  // ---- Selección ----
  function actualizarEstadoSel() {
    const n = seleccion.size;
    lblSel.textContent = n ? `${objs(n)} ${pl(n, 'seleccionado', 'seleccionados')}` : '';
    for (const b of Object.values(botonesEd)) b.disabled = n === 0;
    btnBorrar.disabled = n === 0;
    panelCapas.elegidos(n);
  }
  function limpiarSeleccion() {
    if (!seleccion.size) return;
    seleccion.clear();
    actualizarEstadoSel();
    pedirDibujo();
  }
  // lista: [{ col, id, k }]. Con Shift se suma (o, en un clic, se quita si ya estaba).
  function aplicarSeleccion(lista, { shift, alternar }) {
    if (!shift) seleccion.clear();
    for (const h of lista) {
      if (shift && alternar && seleccion.has(h.k)) seleccion.delete(h.k);
      else seleccion.set(h.k, { col: h.col, id: h.id });
    }
    actualizarEstadoSel();
    pedirDibujo();
  }
  // Saca de la selección lo que ya no existe o ya no se puede elegir.
  function depurarSeleccion() {
    if (seleccion.size) {
      const validos = new Set(elegibles(proy()).map((h) => h.k));
      for (const k of [...seleccion.keys()]) {
        if (!validos.has(k)) seleccion.delete(k);
      }
    }
    actualizarEstadoSel();
  }
  function finalizarArrastre(aplicar) {
    const a = arrastre;
    arrastre = null;
    if (a && aplicar) {
      if (!a.movio) {
        const h = objetoEn(proy(), vista, a.x0, a.y0);
        aplicarSeleccion(h ? [h] : [], { shift: a.shift, alternar: true });
      } else {
        aplicarSeleccion(objetosEnVentana(proy(), vista, a.x0, a.y0, a.x1, a.y1), { shift: a.shift, alternar: false });
      }
    }
    recalcular();
  }
  // ---- Edición: tiradores, mover, copiar, rotar, espejo, escala, alinear, matrices ----
  function textoMatrizR(e) {
    const q = e.par;
    const n = 'MATRIZ RECTANGULAR';
    switch (e.fase) {
      case 'filas': return `${n} — Cantidad de FILAS (se apilan hacia arriba). Escribí un número, o Enter para dejar ${q.filas}:`;
      case 'cols': return `${n} — Cantidad de COLUMNAS (van hacia la derecha). Escribí un número, o Enter para dejar ${q.cols}:`;
      case 'sepf': return `${n} — Separación entre FILAS en metros, de un objeto al mismo punto del siguiente (negativa = hacia abajo). Enter deja ${libre(q.sepf)}:`;
      case 'sepc': return `${n} — Separación entre COLUMNAS en metros, de un objeto al mismo punto del siguiente (negativa = hacia la izquierda). Enter deja ${libre(q.sepc)}:`;
      default: return `${n} — Vista previa lista (${q.filas * q.cols - 1} copias). Enter aplica, Esc cancela:`;
    }
  }
  function textoMatrizP(e) {
    const q = e.par;
    const n = 'MATRIZ POLAR';
    switch (e.fase) {
      case 'centro': return `${n} — Centro de la matriz (clic o x,y):`;
      case 'cant': return `${n} — Cantidad TOTAL de objetos, contando el original (2 a 501). Enter deja ${q.cant}:`;
      case 'ang': return `${n} — Ángulo total en grados (360 = vuelta completa; negativo = sentido horario). Enter deja ${libre(q.ang)}:`;
      default: return `${n} — ¿Las copias giran con la matriz? S = sí, N = no (Enter = ${q.gira ? 'sí' : 'no'}):`;
    }
  }
  function textoEdicion() {
    const e = edicion;
    const nombre = NOMBRE_ED[e.tipo];
    switch (e.tipo) {
      case 'mover':
      case 'copiar':
        if (e.fase === 'base') return `${nombre} — Punto base (clic o x,y):`;
        return `${nombre} — Punto de destino (clic, x,y, @dx,dy o un largo). Enter termina:`;
      case 'rotar':
        if (e.fase === 'base') return 'ROTAR — Punto base (clic o x,y):';
        return `ROTAR — Ángulo en grados, antihorario (escribí el número o hacé clic). C = ${e.copiar ? 'sin copia' : 'dejar copia'}${e.copiar ? ' (COPIA ACTIVADA)' : ''}:`;
      case 'escala':
        if (e.fase === 'base') return 'ESCALA — Punto base (clic o x,y):';
        return `ESCALA — Factor (ej. 2 o 0.5), o clic a esa distancia en metros del punto base. C = ${e.copiar ? 'sin copia' : 'dejar copia'}${e.copiar ? ' (COPIA ACTIVADA)' : ''}:`;
      case 'espejo':
        if (e.fase === 'p1') return 'ESPEJO — Primer punto del eje (clic o x,y):';
        if (e.fase === 'p2') return 'ESPEJO — Segundo punto del eje (clic, x,y o @dx,dy):';
        return 'ESPEJO — ¿Borrar los objetos originales? S = sí, N = no (Enter = no):';
      case 'alinear':
        if (e.fase === 's1') return 'ALINEAR — Primer punto de origen (sobre el objeto):';
        if (e.fase === 'd1') return 'ALINEAR — Primer punto de destino:';
        if (e.fase === 's2') return 'ALINEAR — Segundo punto de origen (Enter = solo mover):';
        if (e.fase === 'd2') return 'ALINEAR — Segundo punto de destino:';
        return 'ALINEAR — ¿Escalar los objetos según los puntos? S = sí, N = no (Enter = no):';
      case 'matrizr':
        return textoMatrizR(e);
      case 'matrizp':
        return textoMatrizP(e);
      case 'tirador': {
        const g = e.grip;
        if (g.tipo === 'radio') return 'ESTIRAR — Nuevo radio: clic, o escribí el valor en metros (ej. 1.5). Esc cancela:';
        if (g.tipo === 'angulo') return 'ESTIRAR — Nueva posición del extremo del arco (clic o x,y): cambia solo el ángulo. Esc cancela:';
        if (g.tipo === 'centro') return 'ESTIRAR — Nueva posición del centro (clic, x,y o @dx,dy): mueve toda la figura. Esc cancela:';
        if (g.tipo === 'medio') return 'ESTIRAR — Nueva posición del punto medio (clic, x,y o @dx,dy): mueve toda la figura. Esc cancela:';
        if (g.tipo === 'vertice') return 'ESTIRAR — Nueva posición del vértice (clic, x,y o @dx,dy). Esc cancela:';
        return 'ESTIRAR — Nueva posición del extremo (clic, x,y o @dx,dy). Esc cancela:';
      }
      default:
        return '';
    }
  }
  function marcarBotones() {
    for (const [tipo, b] of Object.entries(botonesEd)) b.classList.toggle('activa', edicion?.tipo === tipo);
    for (const [tipo, b] of Object.entries(botonesCorte)) b.classList.toggle('activa', corte?.tipo === tipo);
    for (const [tipo, b] of Object.entries(botonesObra)) b.classList.toggle('activa', obra?.tipo === tipo);
    for (const [tipo, b] of Object.entries(botonesMedir)) b.classList.toggle('activa', medir?.tipo === tipo);
    menus.actualizar();
  }
  // Sale por completo de la herramienta de dibujo (Esc dos veces, como en AutoCAD).
  function salirDeDibujo() {
    for (let i = 0; i < 3 && dibujo.herramienta; i++) dibujo.cancelar();
    return !dibujo.herramienta;
  }
  // Copia de las medidas recordadas para una matriz.
  const parMatriz = () => ({
    filas: ajustes.filas, cols: ajustes.cols, sepf: ajustes.sepf, sepc: ajustes.sepc,
    cant: ajustes.cant, ang: ajustes.ang, gira: ajustes.gira,
  });
  function iniciarEdicion(tipo) {
    if (!salirDeDibujo()) {
      barra.mensaje('Terminá primero el dibujo (Esc).', 'error');
      return;
    }
    if (corte) terminarCorte();
    if (obra) terminarObra();
    if (medir) terminarMedir();
    depurarSeleccion();
    if (!seleccion.size) {
      barra.mensaje(`Primero elegí objetos (clic o ventana) y después escribí ${COMANDO_ED[tipo]}.`, 'error');
      return;
    }
    edicion = {
      tipo, fase: FASE_INICIAL[tipo], base: null, copias: 0, pts: [], copiar: false, T: null, grip: null,
      par: tipo.startsWith('matriz') ? parMatriz() : null,
    };
    barra.indicar(textoEdicion());
    marcarBotones();
    canvas.focus();
    recalcular();
  }
  // Agarra un tirador (clic sobre un cuadradito de un objeto elegido).
  function iniciarTirador(g) {
    edicion = { tipo: 'tirador', fase: 'destino', base: null, copias: 0, pts: [], copiar: false, T: null, grip: g, par: null };
    barra.indicar(textoEdicion());
    marcarBotones();
    recalcular();
  }
  function terminarEdicion() {
    edicion = null;
    barra.indicar(dibujo.texto());
    marcarBotones();
    recalcular();
  }
  // ---- Borrar tramo, Partir y Agregar vértice (no necesitan elegir objetos antes) ----
  function iniciarCorte(tipo) {
    if (!salirDeDibujo()) {
      barra.mensaje('Terminá primero el dibujo (Esc).', 'error');
      return;
    }
    if (edicion) terminarEdicion();
    if (obra) terminarObra();
    if (medir) terminarMedir();
    limpiarSeleccion();
    corte = { tipo, plan: null };
    barra.indicar(TEXTO_CORTE[tipo]);
    marcarBotones();
    canvas.focus();
    recalcular();
  }
  function terminarCorte() {
    corte = null;
    barra.indicar(dibujo.texto());
    marcarBotones();
    recalcular();
  }
  // Qué pasaría si se hiciera clic ahora: { h, ...plan } o { h, error }, o null si no hay objeto debajo.
  function planEnCursor() {
    const columnas = corte.tipo === 'vertice' ? ['polilineas'] : null;
    const h = objetoCercano(proy(), vista, px, py, columnas);
    if (!h) return null;
    const m = vista.aMundo(px, py);
    if (corte.tipo === 'tramo') return { h, ...planDeTramo(proy(), h.col, h.o, m.x, m.y) };
    // Partir y agregar vértice: si el imán se pegó a un punto que está sobre este objeto, se usa ese punto.
    const imantado = cursor && ['extremo', 'medio', 'interseccion'].includes(cursor.tipo)
      && distanciaAObjeto(h.col, h.o, cursor.x, cursor.y) < 1e-4;
    const q = imantado ? cursor : m;
    if (corte.tipo === 'partir') return { h, ...planDePartir(h.col, h.o, q.x, q.y) };
    return { h, ...planDeVertice(h.o, q.x, q.y) };
  }
  function hacerCorte() {
    const plan = corte.plan;
    if (!plan) {
      barra.mensaje(corte.tipo === 'vertice'
        ? 'Ahí no hay ninguna polilínea. Hacé clic sobre una.'
        : 'Ahí no hay ningún objeto. Hacé clic sobre uno (los de capas ocultas o bloqueadas no se pueden tocar).', 'error');
      return;
    }
    if (plan.error) { barra.mensaje(plan.error, 'error'); return; }
    const tipo = corte.tipo;
    aplicarCorte(sesion.historial, plan, NOMBRE_CORTE[tipo]);
    if (tipo === 'tramo') {
      if (plan.entero) barra.mensaje('Objeto borrado entero: no tenía cruces que lo limiten. Ctrl+Z para deshacer.', 'ok');
      else if (plan.col === 'circulos') barra.mensaje('Tramo borrado: el círculo quedó como arco. Ctrl+Z para deshacer.', 'ok');
      else barra.mensaje('Tramo borrado. Ctrl+Z para deshacer.', 'ok');
    } else if (tipo === 'partir') {
      if (plan.piezas.length === 1) barra.mensaje('Polilínea cerrada: quedó abierta en ese punto. Ctrl+Z para deshacer.', 'ok');
      else barra.mensaje('Objeto partido en dos. Ahora son independientes. Ctrl+Z para deshacer.', 'ok');
    } else {
      barra.mensaje('Vértice agregado. Ctrl+Z para deshacer.', 'ok');
    }
    recalcular();
  }
  // ---- Extender, Empalme, Chaflán y Desfase (no necesitan elegir objetos antes) ----
  const vivo = (a) => proy()[a.col].find((x) => x.id === a.id);
  function textoObra() {
    const o = obra;
    switch (o.tipo) {
      case 'extender':
        return 'EXTENDER — Clic sobre la línea, muro o arco, cerca del extremo que querés alargar (llega hasta el primer objeto que encuentre; lo nuevo se ve en verde). Esc termina:';
      case 'empalme':
        return `EMPALME (radio ${libre(ajustes.radio)} m) — Clic en el ${o.fase === 'uno' ? 'primer' : 'segundo'} objeto, del lado que querés CONSERVAR. Escribí un número para cambiar el radio (0 = esquina viva). Esc ${o.fase === 'uno' ? 'termina' : 'vuelve atrás'}:`;
      case 'chaflan':
        return `CHAFLÁN (distancias ${libre(ajustes.d1)} y ${libre(ajustes.d2)} m) — Clic en el ${o.fase === 'uno' ? 'primer' : 'segundo'} objeto, del lado que querés CONSERVAR. Escribí una distancia (o dos, ej. 3,2) para cambiarlas. Esc ${o.fase === 'uno' ? 'termina' : 'vuelve atrás'}:`;
      default:
        if (o.fase === 'uno') return `DESFASE (distancia ${libre(ajustes.desfase)} m) — Clic en el objeto. Escribí un número para cambiar la distancia. Esc termina:`;
        return `DESFASE (distancia ${libre(ajustes.desfase)} m) — Clic del lado hacia donde va la copia. Un número cambia la distancia. Esc vuelve a elegir objeto:`;
    }
  }
  function iniciarObra(tipo) {
    if (!salirDeDibujo()) {
      barra.mensaje('Terminá primero el dibujo (Esc).', 'error');
      return;
    }
    if (edicion) terminarEdicion();
    if (corte) terminarCorte();
    if (medir) terminarMedir();
    limpiarSeleccion();
    obra = { tipo, fase: 'uno', a: null, plan: null };
    barra.indicar(textoObra());
    marcarBotones();
    canvas.focus();
    recalcular();
  }
  function terminarObra() {
    obra = null;
    barra.indicar(dibujo.texto());
    marcarBotones();
    recalcular();
  }
  // Qué pasaría si se hiciera clic ahora: { h, ...plan } o { h, error } o { h } (solo resaltar), o null.
  function planObraEnCursor() {
    const o = obra;
    const m = vista.aMundo(px, py);
    if (o.tipo === 'desfase' && o.fase === 'lado') {
      const viva = vivo(o.a);
      if (!viva) return null;
      return { h: o.a, ...planDeDesfase(o.a.col, viva, ajustes.desfase, m.x, m.y) };
    }
    const h = objetoCercano(proy(), vista, px, py, COLUMNAS_OBRA[o.tipo]);
    if (!h) return null;
    if (o.tipo === 'desfase') return { h };
    if (o.tipo === 'extender') return { h, ...planDeExtender(proy(), h.col, h.o, m.x, m.y) };
    if (o.fase === 'uno') return { h };
    const va = vivo(o.a);
    if (!va) return null;
    return { h, ...planDeEsquina(o.tipo, { col: o.a.col, o: va }, o.a.click, { col: h.col, o: h.o }, m, ajustes) };
  }
  function hacerObra() {
    const o = obra;
    const pc = o.plan;
    if (!pc) {
      if (o.a && !vivo(o.a)) {
        o.a = null;
        o.fase = 'uno';
        barra.indicar(textoObra());
        barra.mensaje('El objeto elegido ya no existe. Elegí de nuevo.', 'error');
        recalcular();
        return;
      }
      barra.mensaje('Ahí no hay ningún objeto que sirva para esta herramienta (los de capas ocultas o bloqueadas no se pueden tocar).', 'error');
      return;
    }
    const primerPaso = o.fase === 'uno' && o.tipo !== 'extender';
    if (primerPaso) {
      const m = vista.aMundo(px, py);
      o.a = { col: pc.h.col, id: pc.h.o.id, k: pc.h.k, click: { x: m.x, y: m.y } };
      o.fase = o.tipo === 'desfase' ? 'lado' : 'dos';
      barra.indicar(textoObra());
      recalcular();
      return;
    }
    if (pc.error) { barra.mensaje(pc.error, 'error'); return; }
    aplicarObra(sesion.historial, pc, NOMBRE_OBRA[o.tipo]);
    barra.mensaje(`${pc.hecho} Ctrl+Z para deshacer.`, 'ok');
    if (o.tipo !== 'extender') {
      o.a = null;
      o.fase = 'uno';
    }
    barra.indicar(textoObra());
    recalcular();
  }
  // Números escritos durante Empalme, Chaflán y Desfase: cambian el radio o las distancias. true si lo usó.
  function entradaObra(t) {
    const o = obra;
    if (o.tipo === 'extender') return false;
    const partes = t.split(/[,\s]+/).filter(Boolean);
    const nums = partes.map(Number);
    if (!partes.length || partes.length > 2 || nums.some((n) => !Number.isFinite(n))) return false;
    if (o.tipo === 'chaflan') {
      const [d1, d2 = d1] = nums;
      if (d1 < 0 || d2 < 0 || d1 > 1000 || d2 > 1000) { barra.mensaje('Las distancias tienen que estar entre 0 y 1000 m.', 'error'); return true; }
      if (d1 === 0 && d2 === 0) { barra.mensaje('Las dos distancias en cero no hacen nada. Usá EMPALME para una esquina viva.', 'error'); return true; }
      ajustes.d1 = d1;
      ajustes.d2 = d2;
      barra.mensaje(`Distancias del chaflán: ${libre(d1)} m y ${libre(d2)} m.`, 'ok');
    } else {
      if (partes.length !== 1) return false;
      const n = nums[0];
      if (o.tipo === 'empalme') {
        if (n < 0 || n > 1000) { barra.mensaje('El radio tiene que estar entre 0 y 1000 m.', 'error'); return true; }
        ajustes.radio = n;
        barra.mensaje(n === 0 ? 'Radio 0: esquina viva.' : `Radio del empalme: ${libre(n)} m.`, 'ok');
      } else {
        if (!(n > 0) || n > 1000) { barra.mensaje('La distancia tiene que ser mayor que 0 y hasta 1000 m.', 'error'); return true; }
        ajustes.desfase = n;
        barra.mensaje(`Distancia del desfase: ${libre(n)} m.`, 'ok');
      }
    }
    barra.indicar(textoObra());
    recalcular();
    return true;
  }
  // ---- Distancia y Área (miden, no modifican nada) ----
  function textoMedir() {
    const m = medir;
    if (m.tipo === 'distancia') {
      return m.pts.length
        ? 'DISTANCIA — Segundo punto (clic, x,y o @dx,dy). Esc cancela esta medición:'
        : 'DISTANCIA — Primer punto (clic o x,y; el imán ayuda). Esc termina:';
    }
    if (m.fase === 'objeto') {
      return 'ÁREA — Clic sobre un rectángulo, una polilínea cerrada o un círculo. P vuelve a medir con clics por el contorno. Esc termina:';
    }
    if (!m.pts.length) return 'ÁREA — Primer punto del contorno (clic o x,y). O = medir un objeto ya dibujado. Esc termina:';
    return `ÁREA — Siguiente punto (llevás ${m.pts.length}). Enter o C cierra y mide; U quita el último punto. Esc empieza de nuevo:`;
  }
  function iniciarMedir(tipo) {
    if (!salirDeDibujo()) {
      barra.mensaje('Terminá primero el dibujo (Esc).', 'error');
      return;
    }
    if (edicion) terminarEdicion();
    if (corte) terminarCorte();
    if (obra) terminarObra();
    limpiarSeleccion();
    medir = { tipo, fase: 'puntos', pts: [], res: null, h: null };
    barra.indicar(textoMedir());
    marcarBotones();
    canvas.focus();
    recalcular();
  }
  function terminarMedir() {
    medir = null;
    barra.indicar(dibujo.texto());
    marcarBotones();
    recalcular();
  }
  // Un punto (clic o escrito) para medir.
  function fijarMedir(pt) {
    const m = medir;
    const p = { x: pt.x, y: pt.y };
    if (m.res) { m.res = null; m.pts = []; }   // empieza una medición nueva
    if (m.tipo === 'distancia') {
      if (!m.pts.length) {
        m.pts = [p];
        barra.indicar(textoMedir());
        return;
      }
      if (igualPunto(p, m.pts[0])) {
        barra.mensaje('Los dos puntos coinciden. Elegí otro punto.', 'error');
        return;
      }
      const d = datosDeDistancia(m.pts[0], p);
      m.res = { a: m.pts[0], b: p, d };
      m.pts = [];
      barra.mensaje(textoDistancia(d), 'ok');
      barra.indicar(textoMedir());
      return;
    }
    if (m.pts.length && igualPunto(p, m.pts[m.pts.length - 1])) {
      barra.mensaje('Ese punto coincide con el anterior. Elegí otro.', 'error');
      return;
    }
    m.pts.push(p);
    barra.indicar(textoMedir());
  }
  // Cierra el contorno de Área con los puntos fijados y muestra el resultado.
  function cerrarArea() {
    const m = medir;
    if (m.pts.length < 3) {
      barra.mensaje('Hacen falta al menos 3 puntos para encerrar un área.', 'error');
      return;
    }
    const r = resumenDeArea(m.pts);
    if (r.area < 1e-9) {
      barra.mensaje('Los puntos están alineados: el área es 0. Agregá o cambiá puntos (U quita el último).', 'error');
      return;
    }
    m.res = { ...r, poligono: m.pts, circulo: null };
    m.pts = [];
    barra.mensaje(textoArea(r), 'ok');
    barra.indicar(textoMedir());
  }
  // Clic en Área con la opción de elegir un objeto.
  function medirObjeto() {
    const m = medir;
    if (!m.h) {
      barra.mensaje('Ahí no hay ningún rectángulo, polilínea ni círculo. Hacé clic sobre uno.', 'error');
      return;
    }
    const r = areaDeObjeto(m.h.col, m.h.o);
    if (r.error) { barra.mensaje(r.error, 'error'); return; }
    m.res = r;
    barra.mensaje(textoArea(r), 'ok');
  }
  function hacerClicMedir() {
    if (medir.tipo === 'area' && medir.fase === 'objeto') { medirObjeto(); return; }
    if (cursor) fijarMedir({ x: cursor.x, y: cursor.y });
  }
  // Enter o clic derecho durante una medición.
  function enterEnMedir() {
    const m = medir;
    if (m.tipo === 'area' && m.fase === 'puntos' && m.pts.length) { cerrarArea(); recalcular(); return; }
    terminarMedir();
  }
  // Texto escrito durante una medición que no es un punto (O, P, C, U). true si lo usó.
  function entradaMedir(t, c) {
    const m = medir;
    if (m.tipo === 'area') {
      if (c === 'O' || c === 'OBJETO') {
        m.pts = [];
        m.res = null;
        m.fase = 'objeto';
        barra.indicar(textoMedir());
        recalcular();
        return true;
      }
      if (c === 'P' && m.fase === 'objeto') {
        m.res = null;
        m.fase = 'puntos';
        barra.indicar(textoMedir());
        recalcular();
        return true;
      }
      if (c === 'C' && m.fase === 'puntos') {
        if (m.res) { barra.mensaje('Ya está medido. Hacé clic para empezar otro contorno.', 'error'); return true; }
        cerrarArea();
        recalcular();
        return true;
      }
    }
    if (c === 'U') {
      if (m.pts.length) m.pts.pop();
      else if (m.res) m.res = null;
      else barra.mensaje('No hay puntos para quitar.', 'error');
      barra.indicar(textoMedir());
      recalcular();
      return true;
    }
    return false;
  }
  // Lo que se dibuja de la medición en curso (ver render.js).
  function datosMedicion() {
    const m = medir;
    const d = {
      resaltar: m.h ? [m.h.k] : [],
      poligono: null, cerrado: false, relleno: false, circulo: null,
      lineas: [], puntos: [], textos: [],
    };
    if (m.tipo === 'distancia') {
      if (m.res) {
        const { a, b, d: dt } = m.res;
        const esq = { x: b.x, y: a.y };
        d.lineas.push({ a, b, guion: false });
        if (Math.abs(dt.dx) > 1e-6 && Math.abs(dt.dy) > 1e-6) {
          d.lineas.push({ a, b: esq, guion: true }, { a: esq, b, guion: true });
          d.textos.push(
            { x: (a.x + b.x) / 2, y: a.y, t: `ΔX ${num(dt.dx, 2)}` },
            { x: b.x, y: (a.y + b.y) / 2, t: `ΔY ${num(dt.dy, 2)}` },
          );
        }
        d.puntos.push(a, b);
        d.textos.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: `${num(dt.dist, 2)} m  ∠ ${num(dt.ang, 1)}°` });
      } else if (m.pts.length) {
        const a = m.pts[0];
        d.puntos.push(a);
        if (cursor && !igualPunto(a, cursor)) {
          d.lineas.push({ a, b: cursor, guion: false });
          d.textos.push({ x: (a.x + cursor.x) / 2, y: (a.y + cursor.y) / 2, t: textoMedida(a, cursor) });
        }
      }
      return d;
    }
    // Área
    if (m.res) {
      const r = m.res;
      d.poligono = r.poligono;
      d.cerrado = true;
      d.relleno = true;
      d.circulo = r.circulo ?? null;
      const centro = r.circulo ? { x: r.circulo.cx, y: r.circulo.cy } : promedio(r.poligono);
      d.textos.push({ ...centro, t: `${num(r.area, 2)} m²  ·  perím. ${num(r.perimetro, 2)} m` });
      return d;
    }
    if (m.fase === 'objeto') return d;
    const pts = cursor ? [...m.pts, { x: cursor.x, y: cursor.y }] : [...m.pts];
    d.poligono = pts;
    d.cerrado = pts.length >= 3;
    d.relleno = d.cerrado;
    d.puntos = [...m.pts];
    if (pts.length >= 3) {
      const r = resumenDeArea(pts);
      d.textos.push({ ...promedio(pts), t: `${num(r.area, 2)} m²  ·  perím. ${num(r.perimetro, 2)} m` });
    }
    return d;
  }
  // Fases en las que no se espera un punto (se responde por teclado).
  const faseSinPunto = () => {
    const e = edicion;
    if (e.tipo === 'matrizr') return true;
    if (e.tipo === 'matrizp') return e.fase !== 'centro';
    return e.fase === 'borrar' || e.fase === 'escalar';
  };
  // Último punto útil como referencia para Orto y para coordenadas relativas.
  function baseDeEdicion() {
    const e = edicion;
    if (e.tipo === 'tirador') return { x: e.grip.x, y: e.grip.y };
    if (e.tipo === 'mover' || e.tipo === 'copiar') return e.fase === 'destino' ? e.base : null;
    if (e.tipo === 'alinear' && e.fase === 'd2') return e.pts[1];
    return e.pts.length ? e.pts[e.pts.length - 1] : null;
  }
  const objetoDelTirador = (g) => proy()[g.col].find((x) => x.id === g.id);
  function fijarEdicion(pt) {
    if (!edicion) return;
    if (edicion.tipo === 'tirador') fijarTirador(pt);
    else if (edicion.tipo === 'mover' || edicion.tipo === 'copiar') fijarMoverCopiar(pt);
    else fijarTransformacion(pt);
  }
  // Segundo clic de un tirador: lleva el punto agarrado a pt.
  function fijarTirador(pt) {
    const g = edicion.grip;
    const o = objetoDelTirador(g);
    if (!o) { terminarEdicion(); return; }
    const r = camposPorTirador(g.col, o, g, pt);
    if (r.error) { barra.mensaje(r.error, 'error'); return; }
    modificarObjeto(sesion.historial, g.col, g.id, r.campos, 'Estirar');
    barra.mensaje('Figura modificada. Ctrl+Z para deshacer.', 'ok');
    terminarEdicion();
  }
  function fijarMoverCopiar(pt) {
    if (edicion.fase === 'base') {
      edicion.base = { x: pt.x, y: pt.y };
      edicion.fase = 'destino';
      barra.indicar(textoEdicion());
      return;
    }
    const dx = pt.x - edicion.base.x;
    const dy = pt.y - edicion.base.y;
    if (Math.hypot(dx, dy) < 1e-9) {
      barra.mensaje('El destino coincide con el punto base. Elegí otro punto.', 'error');
      return;
    }
    const lista = objetosSeleccionados(proy(), seleccion);
    if (!lista.length) { terminarEdicion(); return; }
    const n = lista.length;
    const dist = num(Math.hypot(dx, dy), 2);
    if (edicion.tipo === 'mover') {
      moverObjetos(sesion.historial, lista, dx, dy);
      barra.mensaje(`${objs(n)} ${pl(n, 'movido', 'movidos')} ${dist} m.`, 'ok');
      terminarEdicion();
    } else {
      copiarObjetos(sesion.historial, lista, dx, dy);
      edicion.copias += 1;
      barra.mensaje(`${objs(n)} ${pl(n, 'copiado', 'copiados')} a ${dist} m. Otro punto de destino, o Enter para terminar.`, 'ok');
    }
  }
  // Un punto (clic o escrito) para rotar, escalar, espejar, alinear o el centro de una matriz polar.
  function fijarTransformacion(pt) {
    const e = edicion;
    const p = { x: pt.x, y: pt.y };
    const pasar = (fase, pts) => {
      e.pts = pts;
      e.fase = fase;
      barra.indicar(textoEdicion());
    };
    switch (`${e.tipo}:${e.fase}`) {
      case 'rotar:base':
      case 'escala:base':
        pasar('valor', [p]);
        return;
      case 'matrizp:centro':
        pasar('cant', [p]);
        return;
      case 'rotar:valor':
        if (igualPunto(p, e.pts[0])) { barra.mensaje('El punto coincide con el punto base. Elegí otro, o escribí el ángulo.', 'error'); return; }
        aplicarRotar(anguloHacia(e.pts[0], p));
        return;
      case 'escala:valor': {
        const f = Math.hypot(p.x - e.pts[0].x, p.y - e.pts[0].y);
        if (f < 0.001) { barra.mensaje('Muy cerca del punto base. Elegí otro punto, o escribí el factor.', 'error'); return; }
        aplicarEscala(redondear(f));
        return;
      }
      case 'espejo:p1':
        pasar('p2', [p]);
        return;
      case 'espejo:p2':
        if (igualPunto(p, e.pts[0])) { barra.mensaje('Los dos puntos del eje coinciden. Elegí otro punto.', 'error'); return; }
        e.T = reflexion(e.pts[0], p);
        pasar('borrar', [e.pts[0], p]);
        return;
      case 'alinear:s1':
        pasar('d1', [p]);
        return;
      case 'alinear:d1':
        pasar('s2', [e.pts[0], p]);
        return;
      case 'alinear:s2':
        if (igualPunto(p, e.pts[0])) { barra.mensaje('El segundo punto de origen coincide con el primero. Elegí otro.', 'error'); return; }
        pasar('d2', [...e.pts, p]);
        return;
      case 'alinear:d2':
        if (igualPunto(p, e.pts[1])) { barra.mensaje('El segundo punto de destino coincide con el primero. Elegí otro.', 'error'); return; }
        pasar('escalar', [...e.pts, p]);
        return;
      default:
        barra.mensaje('Ahora se responde escribiendo en la barra de comandos. Esc cancela.', 'error');
    }
  }
  // Aplica T a los objetos elegidos. Devuelve cuántos se modificaron (0 si hubo un problema).
  function aplicarT(T, copiar, nombre) {
    const lista = objetosSeleccionados(proy(), seleccion);
    if (!lista.length) { terminarEdicion(); return 0; }
    const err = errorDeTransformacion(lista, T);
    if (err) { barra.mensaje(err, 'error'); return 0; }
    transformarObjetos(sesion.historial, lista, T, { copiar, nombre });
    return lista.length;
  }
  function aplicarRotar(grados) {
    const e = edicion;
    const a = redondear(grados);
    if (Math.abs(a % 360) < 1e-9) { barra.mensaje('Ese ángulo no cambia nada (0° o un múltiplo de 360°).', 'error'); return; }
    const copiar = e.copiar;
    const n = aplicarT(rotacion(e.pts[0], a), copiar, 'Rotar');
    if (!n) return;
    barra.mensaje(copiar
      ? `Copia rotada ${num(a, 2)}° de ${objs(n)}. Ctrl+Z para deshacer.`
      : `${objs(n)} ${pl(n, 'rotado', 'rotados')} ${num(a, 2)}°. Ctrl+Z para deshacer.`, 'ok');
    terminarEdicion();
  }
  function aplicarEscala(f) {
    const e = edicion;
    if (Math.abs(f - 1) < 1e-9) { barra.mensaje('El factor 1 no cambia nada.', 'error'); return; }
    const copiar = e.copiar;
    const n = aplicarT(escalado(e.pts[0], f), copiar, 'Escala');
    if (!n) return;
    barra.mensaje(copiar
      ? `Copia a escala ×${num(f, 3)} de ${objs(n)}. Ctrl+Z para deshacer.`
      : `${objs(n)} ${pl(n, 'escalado', 'escalados')} ×${num(f, 3)}. Ctrl+Z para deshacer.`, 'ok');
    terminarEdicion();
  }
  function aplicarEspejo(borrarOriginales) {
    const n = aplicarT(edicion.T, !borrarOriginales, 'Espejo');
    if (!n) return;
    barra.mensaje(borrarOriginales
      ? `${objs(n)} ${pl(n, 'reflejado', 'reflejados')}; originales borrados. Ctrl+Z para deshacer.`
      : `Reflejo de ${objs(n)} creado; los originales se conservan. Ctrl+Z para deshacer.`, 'ok');
    terminarEdicion();
  }
  function aplicarAlinear(escalar) {
    const p = edicion.pts;
    const T = p.length >= 4 ? alineacion(p[0], p[1], p[2], p[3], escalar) : alineacion(p[0], p[1]);
    const n = aplicarT(T, false, 'Alinear');
    if (!n) return;
    barra.mensaje(`${objs(n)} ${pl(n, 'alineado', 'alineados')}. Ctrl+Z para deshacer.`, 'ok');
    terminarEdicion();
  }
  // ---- Matrices ----
  // Pasa a la pregunta siguiente de la matriz rectangular (se saltea la separación si hay una sola fila o columna).
  function avanzarMatrizR() {
    const e = edicion;
    const par = e.par;
    const orden = ['filas', 'cols', 'sepf', 'sepc'];
    let i = orden.indexOf(e.fase) + 1;
    if (orden[i] === 'sepf' && par.filas === 1) i++;
    if (orden[i] === 'sepc' && par.cols === 1) i++;
    e.fase = orden[i] ?? 'listo';
    if (e.fase === 'listo') {
      const r = planDeMatrizRect(par, seleccion.size);
      if (r.error) {
        barra.mensaje(r.error, 'error');
        e.fase = 'filas';
      } else {
        barra.mensaje(`${r.hecho} Mirá la vista previa: Enter aplica, Esc cancela.`, 'ok');
      }
    }
    barra.indicar(textoEdicion());
    recalcular();
  }
  function avanzarMatrizP() {
    const e = edicion;
    e.fase = e.fase === 'cant' ? 'ang' : 'gira';
    barra.indicar(textoEdicion());
    recalcular();
  }
  function aplicarMatrizR() {
    const e = edicion;
    const lista = objetosSeleccionados(proy(), seleccion);
    if (!lista.length) { terminarEdicion(); return; }
    const r = planDeMatrizRect(e.par, lista.length);
    if (r.error) { barra.mensaje(r.error, 'error'); return; }
    repetirObjetos(sesion.historial, lista, r.Ts, 'Matriz rectangular');
    Object.assign(ajustes, e.par);
    barra.mensaje(`${r.hecho} Se crearon ${objs(r.copias * lista.length)}. Ctrl+Z para deshacer.`, 'ok');
    terminarEdicion();
  }
  function aplicarMatrizP(gira) {
    const e = edicion;
    const lista = objetosSeleccionados(proy(), seleccion);
    if (!lista.length) { terminarEdicion(); return; }
    const par = { ...e.par, gira };
    const r = planDeMatrizPolar(par, e.pts[0], lista);
    if (r.error) { barra.mensaje(r.error, 'error'); return; }
    repetirObjetos(sesion.historial, lista, r.Ts, 'Matriz polar');
    Object.assign(ajustes, par);
    barra.mensaje(`${r.hecho} Se crearon ${objs(r.copias * lista.length)}. Ctrl+Z para deshacer.`, 'ok');
    terminarEdicion();
  }
  // Números (y S/N) escritos durante una matriz. true si lo usó.
  function entradaMatriz(t, si, no) {
    const e = edicion;
    const par = e.par;
    if (e.tipo === 'matrizp' && e.fase === 'gira') {
      if (si) aplicarMatrizP(true);
      else if (no) aplicarMatrizP(false);
      else barra.mensaje('Escribí S (las copias giran) o N (no giran). Enter = lo que está indicado.', 'error');
      return true;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) return false;
    const lista = objetosSeleccionados(proy(), seleccion);
    if (e.tipo === 'matrizr') {
      if (e.fase === 'filas' || e.fase === 'cols') {
        if (!Number.isInteger(n) || n < 1 || n > 500) {
          barra.mensaje('Escribí un número entero de 1 a 500.', 'error');
          return true;
        }
        if (e.fase === 'cols') {
          const r = planDeMatrizRect({ ...par, cols: n }, lista.length);
          if (r.error) { barra.mensaje(r.error, 'error'); return true; }
        }
      } else {
        if (Math.abs(n) > 10000) { barra.mensaje('La separación tiene que estar entre -10000 y 10000 m.', 'error'); return true; }
        if (Math.abs(n) < 1e-9) { barra.mensaje('La separación no puede ser 0: las copias quedarían una encima de otra.', 'error'); return true; }
      }
      par[e.fase] = n;
      avanzarMatrizR();
      return true;
    }
    // Matriz polar: cantidad o ángulo
    const r = planDeMatrizPolar({ ...par, [e.fase]: n }, e.pts[0], lista);
    if (r.error) { barra.mensaje(r.error, 'error'); return true; }
    par[e.fase] = n;
    avanzarMatrizP();
    return true;
  }
  // Enter sin texto durante una edición.
  function enterEnEdicion() {
    const e = edicion;
    if (e.tipo === 'espejo' && e.fase === 'borrar') { aplicarEspejo(false); return; }
    if (e.tipo === 'alinear' && e.fase === 's2') { aplicarAlinear(false); return; }
    if (e.tipo === 'alinear' && e.fase === 'escalar') { aplicarAlinear(false); return; }
    if (e.tipo === 'matrizr') {
      if (e.fase === 'listo') aplicarMatrizR(); else avanzarMatrizR();
      return;
    }
    if (e.tipo === 'matrizp') {
      if (e.fase === 'centro') terminarEdicion();
      else if (e.fase === 'gira') aplicarMatrizP(e.par.gira);
      else avanzarMatrizP();
      return;
    }
    terminarEdicion();
  }
  // Texto escrito durante una edición que no es un punto (ángulo, factor, radio, C, S/N). true si lo usó.
  function entradaEdicion(t, c) {
    const e = edicion;
    const si = c === 'S' || c === 'SI' || c === 'SÍ';
    const no = c === 'N' || c === 'NO';
    if (e.tipo === 'matrizr' || (e.tipo === 'matrizp' && e.fase !== 'centro')) return entradaMatriz(t, si, no);
    if (e.tipo === 'tirador') {
      if (e.grip.tipo !== 'radio') return false;
      const n = Number(t);
      if (!Number.isFinite(n)) return false;
      const o = objetoDelTirador(e.grip);
      if (!o) { terminarEdicion(); return true; }
      if (n <= 0) { barra.mensaje('El radio tiene que ser mayor que cero.', 'error'); return true; }
      fijarTirador({ x: o.cx + n, y: o.cy });
      return true;
    }
    if ((e.tipo === 'rotar' || e.tipo === 'escala') && e.fase === 'valor') {
      if (c === 'C') {
        e.copiar = !e.copiar;
        barra.mensaje(`Copia: ${e.copiar ? 'activada (los originales se conservan)' : 'desactivada'}.`, 'ok');
        barra.indicar(textoEdicion());
        return true;
      }
      const n = Number(t);
      if (!Number.isFinite(n)) return false;   // puede ser un punto x,y o un comando
      if (e.tipo === 'rotar') aplicarRotar(n); else aplicarEscala(n);
      return true;
    }
    if (e.tipo === 'espejo' && e.fase === 'borrar') {
      if (si) aplicarEspejo(true);
      else if (no) aplicarEspejo(false);
      else barra.mensaje('Escribí S (borrar los originales) o N (conservarlos). Enter = N.', 'error');
      return true;
    }
    if (e.tipo === 'alinear' && e.fase === 'escalar') {
      if (si) aplicarAlinear(true);
      else if (no) aplicarAlinear(false);
      else barra.mensaje('Escribí S (escalar) o N (no escalar). Enter = N.', 'error');
      return true;
    }
    return false;
  }
  // Lo que se ve mientras se elige: { T, Ts, forma, guias, texto, estirar } o null.
  function previaEdicion() {
    const e = edicion;
    const c = cursor;
    switch (e.tipo) {
      case 'tirador': {
        if (!c) return null;
        const o = objetoDelTirador(e.grip);
        if (!o) return null;
        const r = camposPorTirador(e.grip.col, o, e.grip, c);
        if (r.error) return null;
        return { estirar: { col: e.grip.col, id: e.grip.id, campos: r.campos }, texto: textoTirador(e.grip.col, o, e.grip, r.campos) };
      }
      case 'mover':
      case 'copiar':
        if (e.fase !== 'destino' || !c) return null;
        return { T: traslacion(c.x - e.base.x, c.y - e.base.y), forma: lineaEntre(e.base, c), texto: textoMedida(e.base, c) };
      case 'rotar': {
        if (e.fase !== 'valor' || !c || igualPunto(e.pts[0], c)) return null;
        const a = anguloHacia(e.pts[0], c);
        return { T: rotacion(e.pts[0], a), forma: lineaEntre(e.pts[0], c), texto: `${num(a, 1)}°` };
      }
      case 'escala': {
        if (e.fase !== 'valor' || !c) return null;
        const f = Math.hypot(c.x - e.pts[0].x, c.y - e.pts[0].y);
        if (f < 0.001 || f > 1000) return null;
        return { T: escalado(e.pts[0], f), forma: lineaEntre(e.pts[0], c), texto: `×${num(f, 3)}` };
      }
      case 'espejo':
        if (e.fase === 'p2' && c && !igualPunto(e.pts[0], c)) return { T: reflexion(e.pts[0], c), forma: lineaEntre(e.pts[0], c) };
        if (e.fase === 'borrar') return { T: e.T, forma: lineaEntre(e.pts[0], e.pts[1]) };
        return null;
      case 'alinear': {
        const [s1, d1, s2] = e.pts;
        if (e.fase === 'd1' && c) return { T: traslacion(c.x - s1.x, c.y - s1.y), forma: lineaEntre(s1, c), texto: textoMedida(s1, c) };
        if (e.fase === 's2') return { T: traslacion(d1.x - s1.x, d1.y - s1.y), forma: lineaEntre(s1, d1) };
        if (e.fase === 'd2' && c && !igualPunto(d1, c)) {
          return { T: alineacion(s1, d1, s2, c, false), forma: lineaEntre(s2, c), guias: [{ a: s1, b: d1 }] };
        }
        if (e.fase === 'escalar') return { T: alineacion(...e.pts, false), forma: lineaEntre(e.pts[2], e.pts[3]), guias: [{ a: s1, b: d1 }] };
        return null;
      }
      case 'matrizr': {
        const r = planDeMatrizRect(e.par, seleccion.size);
        return r.error ? null : { Ts: r.Ts };
      }
      case 'matrizp': {
        if (e.fase === 'centro') return null;
        const r = planDeMatrizPolar(e.par, e.pts[0], objetosSeleccionados(proy(), seleccion));
        return r.error ? null : { Ts: r.Ts };
      }
      default:
        return null;
    }
  }
  function borrarSeleccion() {
    if (edicion) terminarEdicion();
    depurarSeleccion();
    if (!seleccion.size) {
      barra.mensaje('No hay objetos elegidos. Elegí con clic o ventana y después Supr.', 'error');
      return;
    }
    const lista = objetosSeleccionados(proy(), seleccion);
    const n = lista.length;
    borrarObjetos(sesion.historial, lista);
    seleccion.clear();
    actualizarEstadoSel();
    barra.mensaje(`${objs(n)} ${pl(n, 'borrado', 'borrados')}. Ctrl+Z para deshacer.`, 'ok');
    recalcular();
  }
  // Pasa los objetos elegidos a otra capa (la capa de destino tiene que estar visible y desbloqueada).
  function asignarCapa(idCapa) {
    if (edicion) terminarEdicion();
    depurarSeleccion();
    if (!seleccion.size) {
      barra.mensaje('Primero elegí objetos (clic o ventana).', 'error');
      return;
    }
    const capa = proy().capas.find((c) => c.id === idCapa);
    if (!capa) {
      barra.mensaje('Esa capa ya no existe.', 'error');
      return;
    }
    if (capa.visible === false || capa.bloqueada) {
      barra.mensaje(`La capa "${capa.nombre}" está oculta o bloqueada. Activala primero.`, 'error');
      return;
    }
    const lista = objetosSeleccionados(proy(), seleccion);
    const n = cambiarCapaObjetos(sesion.historial, lista, idCapa);
    if (n) barra.mensaje(`${objs(n)} ${pl(n, 'pasó', 'pasaron')} a la capa "${capa.nombre}". Ctrl+Z para deshacer.`, 'ok');
    else barra.mensaje(`Los objetos elegidos ya estaban en la capa "${capa.nombre}".`, 'error');
    recalcular();
  }
  // Esc / clic derecho: cancela lo que esté en curso; si no hay nada, limpia la selección.
  function cancelarTodo() {
    if (arrastre) { arrastre = null; recalcular(); return; }
    if (edicion) { terminarEdicion(); return; }
    if (corte) { terminarCorte(); return; }
    if (obra) {
      if (obra.a) {
        obra.a = null;
        obra.fase = 'uno';
        barra.indicar(textoObra());
        recalcular();
        return;
      }
      terminarObra();
      return;
    }
    if (medir) {
      if (medir.pts.length || medir.res) {
        medir.pts = [];
        medir.res = null;
        barra.indicar(textoMedir());
        recalcular();
        return;
      }
      terminarMedir();
      return;
    }
    if (dibujo.herramienta) { dibujo.cancelar(); recalcular(); return; }
    if (seleccion.size) limpiarSeleccion();
    recalcular();
  }
  // ---- Dibujo bajo demanda (solo cuando algo cambia) ----
  let pendiente = false;
  function pedirDibujo() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; pintar(); });
  }
  function pintar() {
    if (!vista.ancho || !vista.alto) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let previa = null;
    let fantasma = null;
    let estirar = null;
    let ventana = null;
    let tiradores = null;
    let cortePrevia = null;
    let obraPrevia = null;
    let medicionPrevia = null;
    if (corte) {
      if (corte.tipo !== 'tramo' && cursor) previa = { forma: null, guias: [], texto: null, marca: cursor };
      const pc = corte.plan;
      if (pc) cortePrevia = { objeto: pc.h ? pc.h.k : null, tramo: pc.tramo ?? null, punto: pc.punto ?? null };
    } else if (obra) {
      const pv = obra.plan;
      const resaltar = [];
      if (obra.a) resaltar.push(obra.a.k);
      if (pv?.h) resaltar.push(pv.h.k);
      const vi = pv && !pv.error ? pv.vista : null;
      if (vi?.resaltar) resaltar.push(...vi.resaltar);
      obraPrevia = { resaltar, nuevos: vi?.nuevos ?? [], quitar: vi?.quitar ?? [], marcas: vi?.marcas ?? [] };
    } else if (medir) {
      if (cursor && !(medir.tipo === 'area' && medir.fase === 'objeto')) previa = { forma: null, guias: [], texto: null, marca: cursor };
      medicionPrevia = datosMedicion();
    } else if (edicion) {
      const pv = previaEdicion();
      previa = {
        forma: pv?.forma ?? null,
        guias: pv?.guias ?? [],
        texto: pv?.texto ?? null,
        marca: cursor && !faseSinPunto() ? cursor : null,
      };
      if (pv?.T) fantasma = { claves: seleccion, T: pv.T };
      if (pv?.Ts) fantasma = { claves: seleccion, Ts: pv.Ts };
      if (pv?.estirar) estirar = pv.estirar;
      if (edicion.tipo === 'matrizp' && edicion.pts.length) {
        obraPrevia = { resaltar: [], nuevos: [], quitar: [], marcas: [edicion.pts[0]] };
      }
    } else if (dibujo.herramienta && cursor) {
      previa = { ...dibujo.previa(cursor), marca: cursor };
    }
    if (seleccion.size && !dibujo.herramienta && !corte && !obra && !medir && (!edicion || edicion.tipo === 'tirador')) {
      tiradores = {
        claves: seleccion,
        caliente,
        activo: edicion ? { k: edicion.grip.k, idx: edicion.grip.idx } : null,
      };
    }
    if (arrastre && arrastre.movio) ventana = { x0: arrastre.x0, y0: arrastre.y0, x1: arrastre.x1, y1: arrastre.y1 };
    dibujar(ctx, vista, proy(), {
      grilla: chkGrilla.checked, previa, seleccion, hover, fantasma, tiradores, estirar, ventana,
      corte: cortePrevia, obra: obraPrevia, medicion: medicionPrevia,
    });
    lblZoom.textContent = `Zoom: ${num(vista.escala, 1)} px/m`;
  }
  // ---- Puntero e imán ----
  let px = null, py = null;   // última posición del cursor, en píxeles
  let cursor = null;          // punto resuelto { x, y, tipo }
  function actualizarPuntero(e) {
    const r = canvas.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
  }
  function recalcular() {
    hover = null;
    caliente = null;
    if (corte) corte.plan = null;
    if (obra) obra.plan = null;
    if (medir) medir.h = null;
    if (px === null) { cursor = null; pedirDibujo(); return; }
    if (corte) {
      const m = vista.aMundo(px, py);
      cursor = corte.tipo === 'tramo'
        ? { x: m.x, y: m.y, tipo: 'libre' }
        : resolverPunto(proy(), vista, px, py, { objetos: chkIman.checked, grilla: chkImanGrilla.checked, orto: false, base: null });
      if (!paneo) corte.plan = planEnCursor();
    } else if (obra) {
      const m = vista.aMundo(px, py);
      cursor = { x: m.x, y: m.y, tipo: 'libre' };
      if (!paneo) obra.plan = planObraEnCursor();
    } else if (medir) {
      if (medir.tipo === 'area' && medir.fase === 'objeto') {
        const m = vista.aMundo(px, py);
        cursor = { x: m.x, y: m.y, tipo: 'libre' };
        if (!paneo) medir.h = objetoCercano(proy(), vista, px, py, ['polilineas', 'circulos']);
      } else {
        cursor = resolverPunto(proy(), vista, px, py, {
          objetos: chkIman.checked, grilla: chkImanGrilla.checked, orto: chkOrto.checked,
          base: medir.pts.length ? medir.pts[medir.pts.length - 1] : null,
        });
      }
    } else if (dibujo.herramienta || edicion) {
      const base = edicion ? baseDeEdicion() : dibujo.base;
      cursor = resolverPunto(proy(), vista, px, py, {
        objetos: chkIman.checked, grilla: chkImanGrilla.checked, orto: chkOrto.checked, base,
      });
    } else {
      const m = vista.aMundo(px, py);
      cursor = { x: m.x, y: m.y, tipo: 'libre' };
      if (!arrastre && !paneo) {
        const h = objetoEn(proy(), vista, px, py);
        hover = h ? h.k : null;
        if (seleccion.size) {
          const g = tiradorEn(proy(), seleccion, vista, px, py);
          caliente = g ? { k: g.k, idx: g.idx } : null;
        }
      }
    }
    if (!paneo) canvas.style.cursor = caliente ? 'pointer' : (espacio ? 'grab' : '');
    lblCoord.textContent = `X: ${num(cursor.x, 2)}   Y: ${num(cursor.y, 2)} m`;
    pedirDibujo();
  }
  for (const c of [chkGrilla, chkIman, chkImanGrilla, chkOrto]) {
    c.addEventListener('change', () => { recalcular(); canvas.focus(); });
  }
  // ---- Tamaño ----
  let encuadrado = false;
  function medir_() {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;   // pestaña oculta
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    vista.ancho = w;
    vista.alto = h;
    if (!encuadrado) { encuadrado = true; encuadrar(); }
    pedirDibujo();
  }
  const observador = new ResizeObserver(medir_);
  observador.observe(lienzo);
  function encuadrar() {
    const caja = cajaDePlanta(proy(), proy().ui.plantaActiva) ?? { x0: -1, y0: -1, x1: 11, y1: 9 };
    vista.encuadrar(caja);
    recalcular();
  }
  // ---- Selector de planta ----
  let firmaPlantas = null;
  function llenarPlantas() {
    const firma = proy().plantas.map((x) => x.id + '|' + x.nombre).join('\n');
    if (firma !== firmaPlantas) {
      firmaPlantas = firma;
      selPlanta.replaceChildren(...proy().plantas.map((pl2) => el('option', { value: pl2.id }, pl2.nombre)));
    }
    selPlanta.value = proy().ui.plantaActiva;
    const inf = plantaInferior(proy(), proy().ui.plantaActiva);
    lblRef.textContent = inf ? `Referencia atenuada: ${inf.nombre}` : '';
  }
  selPlanta.addEventListener('change', () => {
    const id = selPlanta.value;
    if (edicion) terminarEdicion();
    if (corte) terminarCorte();
    if (obra) terminarObra();
    if (medir) terminarMedir();
    seleccion.clear();
    actualizarEstadoSel();
    sesion.historial.cambiarSinHistorial((p) => { p.ui.plantaActiva = id; });
    panelCapas.actualizar();
    canvas.focus();
  });
  chkGrilla.addEventListener('change', pedirDibujo);
  // ---- Comandos escritos ----
  function alternar(chk, nombre) {
    chk.checked = !chk.checked;
    chk.dispatchEvent(new Event('change'));
    barra.mensaje(`${nombre}: ${chk.checked ? 'activado' : 'desactivado'}`, 'ok');
  }
  function ayuda() {
    barra.mensaje('Dibujar: L (línea) · PL (polilínea) · REC (rectángulo) · CI (círculo) · A (arco 3 puntos) · ARCOC (arco centro-inicio-fin) · MU (muro)', 'ok');
    barra.mensaje('Editar: M (mover) · CP (copiar) · B (borrar) · TODO (elegir todo) · CAPAS (panel de capas) · U (deshacer) · REHACER · ORTO (F8) · IMAN (F3) · IMANGRILLA (F9) · GRILLA (F7) · ENCUADRAR', 'ok');
    barra.mensaje('Transformar (primero elegí objetos): RO (rotar) · ES (espejo) · EC (escala) · AL (alinear). En rotar y escala, C deja una copia.', 'ok');
    barra.mensaje('Repetir (primero elegí objetos): MR (matriz rectangular: filas, columnas y separaciones) · MP (matriz polar: centro, cantidad, ángulo). Enter acepta el valor indicado; se ve vista previa; un solo Ctrl+Z.', 'ok');
    barra.mensaje('Medir (no modifica nada): DI (distancia entre dos puntos) · AR (área y perímetro: clics por el contorno, Enter cierra; O = elegir un rectángulo, polilínea cerrada o círculo). Esc limpia la medición, otro Esc termina.', 'ok');
    barra.mensaje('Cortar (no hace falta elegir antes): BT (borrar tramo: clic sobre el pedazo, se borra hasta el cruce más cercano de cada lado) · PA (partir un objeto en un punto) · AV (agregar vértice a una polilínea). Esc termina.', 'ok');
    barra.mensaje('Construir (no hace falta elegir antes): EX (extender hasta el primer objeto) · EM (empalme, con radio opcional) · CH (chaflán, dos distancias) · DF (desfase: copia paralela). En EM, CH y DF escribí un número para cambiar el radio o la distancia. Esc vuelve atrás o termina.', 'ok');
    barra.mensaje('Tiradores: con objetos elegidos, clic en un cuadradito azul, mové el mouse y clic de nuevo (o escribí la medida). En radios alcanza con escribir el valor. Esc cancela.', 'ok');
    barra.mensaje('Elegir: clic sobre un objeto · ventana de izquierda a derecha = lo que queda adentro · de derecha a izquierda = lo que toca · Shift suma o quita · Esc limpia · Supr borra.', 'ok');
    barra.mensaje('Vista: rueda = zoom · botón central, botón derecho arrastrando, o Espacio + arrastrar = desplazar la pantalla (no modifica el dibujo).', 'ok');
    barra.mensaje('Puntos: clic · x,y · @dx,dy · @largo<ángulo · un largo (hacia donde está el cursor) · C cierra · U quita el último punto · Enter, Esc o clic derecho terminan. Decimales con punto.', 'ok');
  }
  function ejecutar(texto) {
    const t = texto.trim();
    if (!t) {
      if (corte) { terminarCorte(); return; }
      if (obra) { terminarObra(); return; }
      if (medir) { enterEnMedir(); return; }
      if (edicion) { enterEnEdicion(); return; }
      if (dibujo.herramienta) dibujo.cancelar();
      else if (ultimaHerr) iniciarDibujo(ultimaHerr);
      recalcular();
      return;
    }
    const c = t.toUpperCase();
    if (edicion && entradaEdicion(t, c)) return;
    if (obra && entradaObra(t)) return;
    if (medir && entradaMedir(t, c)) return;
    if (ALIAS[c]) { iniciarDibujo(ALIAS[c]); return; }
    if (ALIAS_CORTE[c]) { iniciarCorte(ALIAS_CORTE[c]); return; }
    if (ALIAS_OBRA[c]) { iniciarObra(ALIAS_OBRA[c]); return; }
    if (ALIAS_MEDIR[c]) { iniciarMedir(ALIAS_MEDIR[c]); return; }
    const ed = ALIAS_EDICION[c];
    if (ed === 'borrar') { borrarSeleccion(); return; }
    if (ed) { iniciarEdicion(ed); return; }
    switch (c) {
      case 'ORTO': alternar(chkOrto, 'Orto'); return;
      case 'IMAN': case 'IMÁN': alternar(chkIman, 'Imán a objetos'); return;
      case 'IMANGRILLA': alternar(chkImanGrilla, 'Imán a grilla'); return;
      case 'GRILLA': alternar(chkGrilla, 'Grilla'); return;
      case 'ENCUADRAR': case 'ZE': encuadrar(); return;
      case 'CAPAS': alternarPanelCapas(); return;
      case 'TODO': {
        if (edicion || dibujo.herramienta || corte || obra || medir) { barra.mensaje('Terminá primero el comando actual (Esc).', 'error'); return; }
        const todos = elegibles(proy());
        aplicarSeleccion(todos, { shift: false, alternar: false });
        barra.mensaje(todos.length ? `${objs(todos.length)} ${pl(todos.length, 'elegido', 'elegidos')}.` : 'No hay objetos para elegir en esta planta.', todos.length ? 'ok' : 'error');
        return;
      }
      case 'U': case 'DESHACER':
        if (edicion) { barra.mensaje('Terminá el comando (Enter o Esc) antes de deshacer.', 'error'); return; }
        if (dibujo.enCadena) dibujo.retroceder();
        else if (!sesion.historial.deshacer()) barra.mensaje('No hay nada para deshacer.', 'error');
        recalcular();
        return;
      case 'REHACER':
        if (!sesion.historial.rehacer()) barra.mensaje('No hay nada para rehacer.', 'error');
        return;
      case 'AYUDA': case '?': ayuda(); return;
      case 'C':
        if (dibujo.herramienta) { dibujo.cerrar(); recalcular(); return; }
        break;
      default: break;
    }
    if (edicion) {
      if (faseSinPunto()) { barra.mensaje('Respondé la pregunta de la barra de comandos (Esc cancela).', 'error'); return; }
      const r = interpretarPunto(t, baseDeEdicion(), cursor);
      if (r.error) barra.mensaje(r.error, 'error');
      else { fijarEdicion(r.punto); recalcular(); }
      return;
    }
    if (medir) {
      if (medir.tipo === 'area' && medir.fase === 'objeto') {
        barra.mensaje('Hacé clic sobre un objeto. P = volver a medir con clics por el contorno. Esc termina.', 'error');
        return;
      }
      const r = interpretarPunto(t, medir.pts.length ? medir.pts[medir.pts.length - 1] : null, cursor);
      if (r.error) barra.mensaje(r.error, 'error');
      else { fijarMedir(r.punto); recalcular(); }
      return;
    }
    if (corte) {
      barra.mensaje('Esta herramienta se usa con clics sobre el dibujo. Esc o Enter terminan.', 'error');
      return;
    }
    if (obra) {
      barra.mensaje('Esta herramienta se usa con clics sobre el dibujo (y un número para cambiar la medida). Esc vuelve atrás o termina; Enter termina.', 'error');
      return;
    }
    if (dibujo.herramienta) {
      const r = interpretarPunto(t, dibujo.base, cursor);
      if (r.error) barra.mensaje(r.error, 'error');
      else { dibujo.fijar(r.punto); recalcular(); }
      return;
    }
    barra.mensaje(`Comando desconocido: "${t}". Escribí AYUDA.`, 'error');
  }
  // ---- Ratón: zoom con la rueda ----
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    actualizarPuntero(e);
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33;
    dy = Math.max(-300, Math.min(300, dy));
    vista.zoomEn(px, py, Math.exp(-dy * 0.0012));
    recalcular();
  }, { passive: false });
  // ---- Ratón: desplazar (botón central, botón derecho arrastrando, o Espacio + arrastrar), dibujar y elegir (botón izquierdo) ----
  let paneo = null;
  // Botón derecho apretado: { x, y (donde empezó), movio: true cuando ya se arrastró lo suficiente para ser un desplazamiento }
  let derecho = null;
  let espacio = false;
  const cursorReposo = () => { canvas.style.cursor = caliente ? 'pointer' : (espacio ? 'grab' : ''); };
  // Clic derecho rápido (sin arrastrar): termina la medición o cancela la herramienta en curso.
  function clicDerecho() {
    if (medir) { enterEnMedir(); return; }
    if (edicion || dibujo.herramienta || corte || obra) cancelarTodo();
  }
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  // Se anula el menú del navegador; la acción del clic derecho se resuelve al soltar (pointerup).
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    if (derecho) return;   // mientras se mantiene el botón derecho no se atiende ningún otro botón
    if (e.button === 2) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      derecho = { x: e.clientX, y: e.clientY, movio: false };
      return;
    }
    const medio = e.button === 1;
    const conEspacio = e.button === 0 && espacio;
    if (medio || conEspacio) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      paneo = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    if (edicion) {
      e.preventDefault();
      actualizarPuntero(e);
      recalcular();
      if (cursor) fijarEdicion({ x: cursor.x, y: cursor.y });
      recalcular();
      return;
    }
    if (corte) {
      e.preventDefault();
      actualizarPuntero(e);
      recalcular();
      hacerCorte();
      return;
    }
    if (obra) {
      e.preventDefault();
      actualizarPuntero(e);
      recalcular();
      hacerObra();
      return;
    }
    if (medir) {
      e.preventDefault();
      actualizarPuntero(e);
      recalcular();
      hacerClicMedir();
      recalcular();
      return;
    }
    if (dibujo.herramienta) {
      e.preventDefault();
      actualizarPuntero(e);
      recalcular();
      if (cursor) dibujo.fijar({ x: cursor.x, y: cursor.y });
      recalcular();
      return;
    }
    // Sin herramienta: primero se fija si se hizo clic sobre un tirador (con Shift no, para poder sumar o quitar).
    if (seleccion.size && !e.shiftKey) {
      actualizarPuntero(e);
      const g = tiradorEn(proy(), seleccion, vista, px, py);
      if (g) {
        e.preventDefault();
        iniciarTirador(g);
        return;
      }
    }
    // Clic para elegir un objeto, o arrastrar para elegir con ventana.
    e.preventDefault();
    actualizarPuntero(e);
    canvas.setPointerCapture(e.pointerId);
    arrastre = { x0: px, y0: py, x1: px, y1: py, movio: false, shift: e.shiftKey };
    recalcular();
  });
  canvas.addEventListener('pointermove', (e) => {
    // Con el botón derecho apretado, al moverse más de 4 píxeles empieza el desplazamiento.
    if (derecho && !derecho.movio && Math.hypot(e.clientX - derecho.x, e.clientY - derecho.y) > 4) {
      derecho.movio = true;
      paneo = { x: derecho.x, y: derecho.y };
      canvas.style.cursor = 'grabbing';
    }
    if (paneo) {
      vista.desplazar(e.clientX - paneo.x, e.clientY - paneo.y);
      paneo = { x: e.clientX, y: e.clientY };
    }
    actualizarPuntero(e);
    if (arrastre) {
      arrastre.x1 = px;
      arrastre.y1 = py;
      if (!arrastre.movio && Math.hypot(px - arrastre.x0, py - arrastre.y0) > 4) arrastre.movio = true;
    }
    recalcular();
  });
  const soltar = (e) => {
    if (derecho) {
      // Solo termina el botón derecho (o una cancelación); soltar otro botón no corta el desplazamiento.
      if (e.type === 'pointercancel' || e.button === 2) {
        const d = derecho;
        derecho = null;
        paneo = null;
        cursorReposo();
        if (!d.movio && e.type === 'pointerup') clicDerecho();
        recalcular();
      }
      return;
    }
    if (arrastre) finalizarArrastre(e.type === 'pointerup');
    paneo = null;
    cursorReposo();
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  canvas.addEventListener('pointerleave', () => {
    if (paneo || arrastre || derecho) return;
    px = null; py = null; cursor = null; hover = null; caliente = null;
    if (corte) corte.plan = null;
    if (obra) obra.plan = null;
    if (medir) medir.h = null;
    canvas.style.cursor = espacio ? 'grab' : '';
    lblCoord.textContent = 'X: —   Y: —';
    pedirDibujo();
  });
  // ---- Teclado en la hoja ----
  canvas.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); espacio = true; if (!paneo) cursorReposo(); return; }
    const altGr = e.getModifierState && e.getModifierState('AltGraph');   // para escribir "@"
    if ((e.ctrlKey || e.metaKey) && !altGr) return;                       // Ctrl+Z, Ctrl+S, etc. los maneja main.js
    if (e.key === 'Escape') { e.preventDefault(); cancelarTodo(); return; }
    if (e.key === 'Delete') { e.preventDefault(); borrarSeleccion(); return; }
    if (e.key === 'Enter') { e.preventDefault(); ejecutar(''); return; }
    if (e.key.length === 1) { e.preventDefault(); if (barraOculta) alternarBarra(false); barra.escribir(e.key); }   // lo que se escribe va a la barra de comandos
  });
  canvas.addEventListener('keyup', (e) => { if (e.code === 'Space') { espacio = false; if (!paneo) cursorReposo(); } });
  canvas.addEventListener('blur', () => { espacio = false; if (!paneo) cursorReposo(); });
  // Teclas de función (en toda la pestaña)
  contenedor.addEventListener('keydown', (e) => {
    const mapa = {
      F3: [chkIman, 'Imán a objetos'], F7: [chkGrilla, 'Grilla'],
      F8: [chkOrto, 'Orto'], F9: [chkImanGrilla, 'Imán a grilla'],
    };
    const m = mapa[e.key];
    if (!m) return;
    e.preventDefault();
    alternar(m[0], m[1]);
  });
  // ---- Armado ----
  // Menús de la barra superior: cada uno agrupa herramientas y muestra su atajo de teclado.
  const menuDibujar = menus.menu('Dibujar',
    btnLinea, btnPolilinea, btnRect, btnCirculo, btnArco, btnArcoC,
    separadorMenu(),
    btnMuro);
  const menuModificar = menus.menu('Modificar',
    notaMenu('Primero elegí objetos (clic o ventana).'),
    btnMover, btnCopiar, btnRotar, btnEspejo, btnEscala, btnAlinear,
    separadorMenu(),
    btnMatrizR, btnMatrizP,
    separadorMenu(),
    btnBorrar);
  const menuConstruir = menus.menu('Construir',
    btnTramo, btnPartir, btnVertice,
    separadorMenu(),
    btnExtender, btnEmpalme, btnChaflan, btnDesfase);
  const menuMedir = menus.menu('Medir', btnDistancia, btnArea);
  // Interruptores de precisión (barra de estado, abajo).
  const interruptores = el('div', { class: 'cad-interruptores' },
    el('label', { title: 'Grilla visible (F7)' }, chkGrilla, 'Grilla', el('span', { class: 'tecla' }, 'F7')),
    el('label', { title: 'Imán a extremos, medios e intersecciones (F3)' }, chkIman, 'Imán', el('span', { class: 'tecla' }, 'F3')),
    el('label', { title: 'Imán a los puntos de la grilla (F9)' }, chkImanGrilla, 'Imán grilla', el('span', { class: 'tecla' }, 'F9')),
    el('label', { title: 'Orto: solo líneas horizontales o verticales (F8)' }, chkOrto, 'Orto', el('span', { class: 'tecla' }, 'F8')));
  contenedor.replaceChildren(
    el('div', { class: 'cad-barra' },
      el('label', {}, 'Planta:', selPlanta),
      el('span', { class: 'sep-v' }),
      menuDibujar,
      lblEspesor,
      menuModificar,
      menuConstruir,
      menuMedir,
      el('span', { class: 'sep-v' }),
      btnEncuadrar,
      btnCapas),
    el('div', { class: 'cad-cuerpo' }, lienzo, panelCapas.elemento),
    barra.elemento,
    el('div', { class: 'cad-estado' },
      lblCoord, lblZoom, lblRef, lblSel,
      el('span', { class: 'ayuda' }, 'Rueda: zoom · Botón central o derecho: desplazar · Esc: cancelar'),
      interruptores,
      btnBarra));
  llenarPlantas();
  panelCapas.actualizar();
  barra.indicar(dibujo.texto());
  barra.mensaje('Hacé clic en un objeto para elegirlo (o arrastrá una ventana). L = línea, PL = polilínea, REC = rectángulo, CI = círculo, A = arco, MU = muro, AYUDA = todos los comandos.', 'ok');
  return {
    refrescar() {
      llenarPlantas();
      depurarSeleccion();
      panelCapas.actualizar();
      if (edicion && !seleccion.size) terminarEdicion();
      if (corte || obra || medir) recalcular();
      dibujo.revisar();
      pedirDibujo();
    },
    mostrar() { medir_(); },
    destruir() { observador.disconnect(); menus.destruir(); },
  };
}