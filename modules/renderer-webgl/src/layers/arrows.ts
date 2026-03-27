// Arrowhead angle matching the SVG renderer (25 degrees)
const ARROW_ANGLE = 25
const HALF_BASE_RATIO = Math.tan((ARROW_ANGLE / 2) * (Math.PI / 180)) // ~0.222

const CELL = 64

let cachedAtlas: HTMLCanvasElement | null = null

/** Creates a canvas-based icon atlas for arrowheads.
 *  The SVG-based atlas failed with createImageBitmap in modern browsers. */
function createIconAtlas(): HTMLCanvasElement {
  if (cachedAtlas) return cachedAtlas
  const canvas = document.createElement('canvas')
  canvas.width = CELL * 4
  canvas.height = CELL
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2D canvas context for icon atlas')
  ctx.fillStyle = 'black'
  ctx.strokeStyle = 'black'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.5

  // triangle-n (col 0): narrow filled triangle matching SVG renderer's 25° arrowhead
  // Points right, tip at right edge, base at left edge, centered vertically
  // Rounded tip to match SVG renderer
  const halfBase = CELL * HALF_BASE_RATIO
  ctx.beginPath()
  ctx.moveTo(CELL, CELL * 0.5)          // tip
  ctx.lineTo(0, CELL * 0.5 - halfBase)  // top-left
  ctx.lineTo(0, CELL * 0.5 + halfBase)  // bottom-left
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // dot (col 1): filled circle
  ctx.beginPath()
  ctx.arc(CELL * 1.5, CELL * 0.5, CELL * 0.35, 0, Math.PI * 2)
  ctx.fill()

  // circle outline (col 2)
  ctx.beginPath()
  ctx.arc(CELL * 2.5, CELL * 0.5, CELL * 0.35, 0, Math.PI * 2)
  ctx.stroke()

  // caret / chevron (col 3)
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(CELL * 3, CELL * 0.5 - halfBase)
  ctx.lineTo(CELL * 4, CELL * 0.5)
  ctx.lineTo(CELL * 3, CELL * 0.5 + halfBase)
  ctx.stroke()

  cachedAtlas = canvas
  return canvas
}

export function getIconAtlas(): HTMLCanvasElement {
  return createIconAtlas()
}

export const iconMapping: Record<string, {x: number; y: number; width: number; height: number; mask: boolean; anchorX?: number}> = {
  'triangle-n':        {mask: true, x: 0,        y: 0, width: CELL, height: CELL, anchorX: CELL},
  'triangle':          {mask: true, x: 0,        y: 0, width: CELL, height: CELL, anchorX: CELL},
  'triangle-ex':       {mask: true, x: 0,        y: 0, width: CELL, height: CELL},
  'triangle-n-ex':     {mask: true, x: 0,        y: 0, width: CELL, height: CELL},
  'triangle-w':        {mask: true, x: 0,        y: 0, width: CELL, height: CELL, anchorX: CELL},
  'triangle-w-ex':     {mask: true, x: 0,        y: 0, width: CELL, height: CELL},
  'half-triangle':     {mask: true, x: 0,        y: 0, width: CELL, height: CELL / 2, anchorX: CELL},
  'half-triangle-ex':  {mask: true, x: 0,        y: 0, width: CELL, height: CELL / 2},
  'half-triangle-n':   {mask: true, x: 0,        y: 0, width: CELL, height: CELL / 2, anchorX: CELL},
  'half-triangle-n-ex':{mask: true, x: 0,        y: 0, width: CELL, height: CELL / 2},
  'caret':             {mask: true, x: CELL * 3, y: 0, width: CELL, height: CELL, anchorX: CELL},
  'caret-lg':          {mask: true, x: CELL * 3, y: 0, width: CELL, height: CELL, anchorX: CELL},
  'half-caret':        {mask: true, x: CELL * 3, y: 0, width: CELL, height: CELL / 2, anchorX: CELL},
  'dot':               {mask: true, x: CELL,     y: 0, width: CELL, height: CELL, anchorX: CELL * 0.5},
  'dot-ex':            {mask: true, x: CELL,     y: 0, width: CELL, height: CELL},
  'dot-lg':            {mask: true, x: CELL,     y: 0, width: CELL, height: CELL, anchorX: CELL * 0.5},
  'dot-lg-ex':         {mask: true, x: CELL,     y: 0, width: CELL, height: CELL},
  'circle-ex':         {mask: true, x: CELL * 2, y: 0, width: CELL, height: CELL},
  'circle-lg-ex':      {mask: true, x: CELL * 2, y: 0, width: CELL, height: CELL},
}
