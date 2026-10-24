// What a frame looks at: the viewport in world units and the pixel scale. Drawing always happens in
// world coordinates under one transform, so a slice is the same picture as the matching crop of the
// whole world at the same scale. The view is used only to skip what cannot be seen and to keep lines
// legible at small scales, never to move anything.

import type { Box } from "../engine/geometry.js";
import type { Viewport } from "../engine/validate.js";

export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Device pixels per world unit (geometric mean of the two axes). */
  scale: number;
}

export function viewOf(viewport: Viewport, width: number, height: number): View {
  return {
    x0: viewport.x,
    y0: viewport.y,
    x1: viewport.x + viewport.width,
    y1: viewport.y + viewport.height,
    scale: Math.sqrt((width / viewport.width) * (height / viewport.height)),
  };
}

/** Whether anything inside `box`, grown by `pad` world units and a few pixels of antialiasing, can show. */
export function sees(view: View, box: Box, pad = 0): boolean {
  const m = pad + 4 / view.scale + 2;
  return box.x0 - m <= view.x1 && box.x1 + m >= view.x0 && box.y0 - m <= view.y1 && box.y1 + m >= view.y0;
}

/** Whether a disc can show. */
export function seesDisc(view: View, x: number, y: number, r: number): boolean {
  return sees(view, { x0: x - r, y0: y - r, x1: x + r, y1: y + r });
}

/** A length of `px` device pixels in world units, but never less than `min` world units. */
export function pixels(view: View, px: number, min: number): number {
  return Math.max(min, px / view.scale);
}
