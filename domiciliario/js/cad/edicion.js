// Operaciones que modifican objetos: mover, copiar, repetir, transformar, estirar, borrar, cortar y cambiar de capa.
// Cada operación es UN solo paso del historial (un Ctrl+Z la deshace entera).
import { clonar, nuevoId } from '../core/modelo.js';
import { camposTransformados } from './transformar.js';


const PREFIJO = { lineas: 'l', muros: 'm', polilineas: 'pl', circulos: 'c', arcos: 'a' };
const r6 = (n) => Math.round(n * 1e6) / 1e6;


// Campos que cambian al correr un objeto (dx, dy) metros.
function desplazado(col, o, dx, dy) {
  if (col === 'polilineas') return { puntos: o.puntos.map((q) => ({ x: r6(q.x + dx), y: r6(q.y + dy) })) };
  if (col === 'circulos' || col === 'arcos') return { cx: r6(o.cx + dx), cy: r6(o.cy + dy) };
  return { x1: r6(o.x1 + dx), y1: r6(o.y1 + dy), x2: r6(o.x2 + dx), y2: r6(o.y2 + dy) };
}


// lista: [{ col, o }]
export function moverObjetos(historial, lista, dx, dy) {
  historial.transaccion('Mover', (t) => {
    for (const { col, o } of lista) t.modificar(col, o.id, desplazado(col, o, dx, dy));
  });
}


export function copiarObjetos(historial, lista, dx, dy) {
  historial.transaccion('Copiar', (t) => {
    for (const { col, o } of lista) {
      const n = Object.assign(clonar(o), desplazado(col, o, dx, dy));
      n.id = nuevoId(PREFIJO[col] ?? 'o');
      t.agregar(col, n);
    }
  });
}


// Matrices: una copia de toda la lista por cada transformación de Ts (los originales quedan donde están).
export function repetirObjetos(historial, lista, Ts, nombre = 'Matriz') {
  historial.transaccion(nombre, (t) => {
    for (const T of Ts) {
      for (const { col, o } of lista) {
        const n = Object.assign(clonar(o), camposTransformados(col, o, T));
        n.id = nuevoId(PREFIJO[col] ?? 'o');
        t.agregar(col, n);
      }
    }
  });
}


// Rotar, escalar, espejar o alinear (T viene de transformar.js).
// Con copiar = true los originales quedan y se agregan objetos nuevos transformados.
export function transformarObjetos(historial, lista, T, { copiar = false, nombre = 'Transformar' } = {}) {
  historial.transaccion(nombre, (t) => {
    for (const { col, o } of lista) {
      const campos = camposTransformados(col, o, T);
      if (copiar) {
        const n = Object.assign(clonar(o), campos);
        n.id = nuevoId(PREFIJO[col] ?? 'o');
        t.agregar(col, n);
      } else {
        t.modificar(col, o.id, campos);
      }
    }
  });
}


// Cambia campos de UN objeto (lo que hace un tirador al soltarlo).
export function modificarObjeto(historial, col, id, campos, nombre = 'Estirar') {
  historial.transaccion(nombre, (t) => {
    t.modificar(col, id, campos);
  });
}


// Aplica un plan de cortes.js (borrar tramo, partir o agregar vértice).
// plan = { col, o, piezas: [{ col, campos }] }: lo que queda del objeto original.
// La primera pieza reemplaza al original (si es de la misma colección); las demás son objetos nuevos.
// Sin piezas, el original se borra. Si la pieza es de otra colección (círculo → arco), el original se borra.
export function aplicarCorte(historial, plan, nombre = 'Cortar') {
  const base = clonar(plan.o);
  historial.transaccion(nombre, (t) => {
    const nuevas = [...plan.piezas];
    const primera = nuevas[0];
    if (primera && primera.col === plan.col) {
      t.modificar(plan.col, plan.o.id, primera.campos);
      nuevas.shift();
    } else {
      t.quitar(plan.col, plan.o.id);
    }
    for (const pieza of nuevas) {
      const n = Object.assign(clonar(base), pieza.campos);
      n.id = nuevoId(PREFIJO[pieza.col] ?? 'o');
      t.agregar(pieza.col, n);
    }
  });
}


// Aplica un plan de construccion.js (extender, empalme, chaflán o desfase).
// plan.cambios = [{ col, id, campos }]: objetos que existen y cambian.
// plan.agregar = [{ col, objeto }]: objetos nuevos (sin id; se les asigna uno).
export function aplicarObra(historial, plan, nombre = 'Construir') {
  historial.transaccion(nombre, (t) => {
    for (const c of plan.cambios) t.modificar(c.col, c.id, c.campos);
    for (const a of plan.agregar) {
      const n = Object.assign(clonar(a.objeto), { id: nuevoId(PREFIJO[a.col] ?? 'o') });
      t.agregar(a.col, n);
    }
  });
}


export function borrarObjetos(historial, lista) {
  historial.transaccion('Borrar', (t) => {
    for (const { col, o } of lista) t.quitar(col, o.id);
  });
}


// Pasa los objetos a otra capa (un solo paso del historial). Devuelve cuántos cambiaron.
export function cambiarCapaObjetos(historial, lista, idCapa) {
  const aCambiar = lista.filter(({ o }) => o.capa !== idCapa);
  if (!aCambiar.length) return 0;
  historial.transaccion('Cambiar capa', (t) => {
    for (const { col, o } of aCambiar) t.modificar(col, o.id, { capa: idCapa });
  });
  return aCambiar.length;
}