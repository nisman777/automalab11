export const ESCALA_MIN = 2;      // píxeles por metro
export const ESCALA_MAX = 3000;

const limitar = (e) => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, e));

export class Vista {
  constructor() {
    this.escala = 50;   // píxeles por metro
    this.ox = 0;        // posición en pantalla del origen (0,0) del mundo
    this.oy = 0;
    this.ancho = 0;     // tamaño visible, en píxeles CSS
    this.alto = 0;
  }

  aPantalla(x, y) {
    return { x: this.ox + x * this.escala, y: this.oy - y * this.escala };
  }

  aMundo(px, py) {
    return { x: (px - this.ox) / this.escala, y: (this.oy - py) / this.escala };
  }

  desplazar(dx, dy) {
    this.ox += dx;
    this.oy += dy;
  }

  // Zoom manteniendo fijo el punto del mundo que está bajo el cursor.
  zoomEn(px, py, factor) {
    const m = this.aMundo(px, py);
    const e = limitar(this.escala * factor);
    this.escala = e;
    this.ox = px - m.x * e;
    this.oy = py + m.y * e;
  }

  // Ajusta la vista para que entre toda la caja {x0,y0,x1,y1}.
  encuadrar(caja, margen = 0.08) {
    if (!this.ancho || !this.alto) return;
    const w = Math.max(caja.x1 - caja.x0, 0.5);
    const h = Math.max(caja.y1 - caja.y0, 0.5);
    const util = 1 - 2 * margen;
    const e = limitar(Math.min((this.ancho * util) / w, (this.alto * util) / h));
    const cx = (caja.x0 + caja.x1) / 2;
    const cy = (caja.y0 + caja.y1) / 2;
    this.escala = e;
    this.ox = this.ancho / 2 - cx * e;
    this.oy = this.alto / 2 + cy * e;
  }
}