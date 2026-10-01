import type { RoughCanvas } from 'roughjs/bin/canvas'
import type { Options } from 'roughjs/bin/core'
import { getStroke } from 'perfect-freehand'
import rough from 'roughjs'
import { ASSET_MAP, type Shape } from './assets'
import { LOGO_MAP, logoPath } from './logos'

export type P = [number, number]
export type Rect = { x: number; y: number; w: number; h: number }
export const BW = 1920, BH = 1080
export const FULL: Rect = { x: 0, y: 0, w: BW, h: BH }

export type FillStyle = 'none' | 'hachure' | 'cross-hatch' | 'zigzag' | 'solid'
export type Style = { stroke: string; fill: string; fillStyle: FillStyle; strokeWidth: number; roughness: number; font: string; fontSize: number }
export type ElType = 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'pen' | 'text' | 'asset'
export type El = Style & { id: string; type: ElType; x: number; y: number; w: number; h: number; seed: number; points?: P[]; text?: string; asset?: string }
export type Page = { id: string; name?: string; board: BoardId; elements: El[] }

export type BoardId = keyof typeof BOARDS
type Board = { name: string; bg: string; ink: string; paint?: (c: CanvasRenderingContext2D) => void }

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const gridLines = (c: CanvasRenderingContext2D, step: number, color: string, width = 1, offset = 0) => {
  c.strokeStyle = color
  c.lineWidth = width
  c.beginPath()
  for (let x = offset || step; x < BW; x += step) c.moveTo(x + 0.5, 0), c.lineTo(x + 0.5, BH)
  for (let y = offset || step; y < BH; y += step) c.moveTo(0, y + 0.5), c.lineTo(BW, y + 0.5)
  c.stroke()
}

const speckle = (c: CanvasRenderingContext2D, n: number, color: string, size: number, seed: number, streak = false) => {
  const r = rng(seed)
  c.fillStyle = c.strokeStyle = color
  c.lineWidth = 1.2
  for (let i = 0; i < n; i++) {
    const x = r() * BW, y = r() * BH
    if (!streak) { c.fillRect(x, y, size * r() + 0.6, size * r() + 0.6); continue }
    const a = r() * Math.PI, l = 6 + r() * 14
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    c.stroke()
  }
}

const wash = (c: CanvasRenderingContext2D, stops: string[], x1 = BW, y1 = BH) => {
  const g = c.createLinearGradient(0, 0, x1, y1)
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s))
  c.fillStyle = g
  c.fillRect(0, 0, BW, BH)
}

const blob = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(x - r, y - r, r * 2, r * 2)
}

export const BOARDS = {
  paper: { name: 'Paper', bg: '#fbf8f1', ink: '#1f1f1f', paint: c => speckle(c, 2600, 'rgba(120,96,50,.07)', 2.4, 3) },
  notebook: {
    name: 'Notebook', bg: '#fdfcf7', ink: '#1d2b53',
    paint: c => {
      c.fillStyle = '#c9daf2'
      for (let y = 150; y < BH; y += 52) c.fillRect(0, y, BW, 2)
      c.fillStyle = '#f2a7a7'
      c.fillRect(176, 0, 2, BH)
      c.fillRect(182, 0, 2, BH)
      ;[200, 540, 880].forEach(y => {
        c.beginPath()
        c.arc(78, y, 22, 0, Math.PI * 2)
        c.fillStyle = '#ebe7dc'
        c.fill()
      })
    },
  },
  dots: { name: 'Dots', bg: '#fafaf7', ink: '#1f1f1f', paint: c => { c.fillStyle = '#cdc8bd'; for (let x = 40; x < BW; x += 40) for (let y = 40; y < BH; y += 40) c.fillRect(x - 1.6, y - 1.6, 3.2, 3.2) } },
  graph: { name: 'Graph', bg: '#f6fbf7', ink: '#173a2b', paint: c => { gridLines(c, 24, '#dfede4'); gridLines(c, 120, '#b8d8c4', 1.5) } },
  iso: {
    name: 'Isometric', bg: '#fbfaff', ink: '#2b2350',
    paint: c => {
      c.strokeStyle = '#e4e0f5'
      c.lineWidth = 1
      c.beginPath()
      const t = Math.tan(Math.PI / 6), V = 56, span = BH / t
      for (let x = -Math.ceil(span / (2 * V)) * 2 * V; x < BW + span; x += 2 * V) {
        c.moveTo(x, 0), c.lineTo(x + span, BH)
        c.moveTo(x, 0), c.lineTo(x - span, BH)
      }
      for (let x = V; x < BW; x += V) c.moveTo(x + 0.5, 0), c.lineTo(x + 0.5, BH)
      c.stroke()
    },
  },
  sticky: {
    name: 'Sticky note', bg: '#fff1a1', ink: '#3b2f00',
    paint: c => {
      wash(c, ['#fff6b8', '#ffe97a'], 0, BH)
      c.fillStyle = '#f0d860'
      c.beginPath()
      c.moveTo(BW, BH - 120), c.lineTo(BW - 120, BH), c.lineTo(BW, BH)
      c.fill()
      c.fillStyle = '#ffef9a'
      c.beginPath()
      c.moveTo(BW, BH - 120), c.lineTo(BW - 120, BH), c.lineTo(BW - 110, BH - 110)
      c.fill()
      c.save()
      c.translate(BW / 2, 18)
      c.rotate(-0.03)
      c.fillStyle = 'rgba(255,255,255,.55)'
      c.fillRect(-150, -30, 300, 64)
      c.restore()
    },
  },
  confetti: {
    name: 'Confetti', bg: '#fffdf8', ink: '#1f1f1f',
    paint: c => {
      const r = rng(9), colors = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#cc5de8', '#ff922b']
      for (let i = 0; i < 160; i++) {
        const x = r() * BW, y = r() * BH
        if (Math.abs(x - BW / 2) < 700 && Math.abs(y - BH / 2) < 380) continue
        c.save()
        c.translate(x, y)
        c.rotate(r() * Math.PI)
        c.fillStyle = colors[i % colors.length]
        c.globalAlpha = 0.75
        if (i % 3) c.fillRect(-9, -4, 18, 8)
        else c.beginPath(), c.arc(0, 0, 6, 0, Math.PI * 2), c.fill()
        c.restore()
      }
    },
  },
  pastel: {
    name: 'Pastel', bg: '#f3e8f1', ink: '#2a2540',
    paint: c => {
      wash(c, ['#fde2e4', '#f3eaf7', '#dfe7fd'])
      blob(c, 260, 220, 420, 'rgba(255,214,165,.55)')
      blob(c, 1680, 860, 480, 'rgba(189,178,255,.45)')
      blob(c, 1500, 160, 300, 'rgba(202,255,191,.4)')
    },
  },
  sunset: {
    name: 'Sunset', bg: '#ffc8a8', ink: '#2d1b3d',
    paint: c => {
      wash(c, ['#ffe1b0', '#ffb5a7', '#c9b6ff'], 0, BH)
      blob(c, BW * 0.78, BH * 0.3, 260, 'rgba(255,240,200,.7)')
      speckle(c, 1800, 'rgba(80,30,60,.05)', 2, 5)
    },
  },
  blueprint: {
    name: 'Blueprint', bg: '#1a4b8c', ink: '#eaf3ff',
    paint: c => {
      gridLines(c, 24, 'rgba(255,255,255,.06)')
      gridLines(c, 120, 'rgba(255,255,255,.16)', 1.5)
      c.strokeStyle = 'rgba(255,255,255,.5)'
      c.lineWidth = 2
      c.strokeRect(24, 24, BW - 48, BH - 48)
      c.strokeRect(BW - 384, BH - 144, 360, 120)
      c.beginPath()
      c.moveTo(BW - 384, BH - 96), c.lineTo(BW - 24, BH - 96)
      c.moveTo(BW - 204, BH - 96), c.lineTo(BW - 204, BH - 24)
      c.stroke()
    },
  },
  chalk: {
    name: 'Chalkboard', bg: '#24382f', ink: '#f4f1e6',
    paint: c => {
      const r = rng(4)
      for (let i = 0; i < 14; i++) blob(c, r() * BW, r() * BH, 160 + r() * 260, 'rgba(255,255,255,.045)')
      speckle(c, 900, 'rgba(255,255,255,.05)', 3, 8, true)
      c.strokeStyle = '#7a5232'
      c.lineWidth = 28
      c.strokeRect(14, 14, BW - 28, BH - 28)
      c.strokeStyle = 'rgba(0,0,0,.25)'
      c.lineWidth = 2
      c.strokeRect(29, 29, BW - 58, BH - 58)
    },
  },
  terminal: {
    name: 'Terminal', bg: '#0b0f0c', ink: '#7cffa0',
    paint: c => {
      c.fillStyle = 'rgba(124,255,160,.035)'
      for (let y = 0; y < BH; y += 4) c.fillRect(0, y, BW, 1.5)
      const g = c.createRadialGradient(BW / 2, BH / 2, BH * 0.4, BW / 2, BH / 2, BW * 0.7)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,.55)')
      c.fillStyle = g
      c.fillRect(0, 0, BW, BH)
    },
  },
  night: {
    name: 'Night sky', bg: '#0f1220', ink: '#f5f5f5',
    paint: c => {
      wash(c, ['#141833', '#0d0f1c'], 0, BH)
      const r = rng(2)
      for (let i = 0; i < 320; i++) {
        c.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.6})`
        c.beginPath()
        c.arc(r() * BW, r() * BH, r() * 1.8 + 0.4, 0, Math.PI * 2)
        c.fill()
      }
    },
  },
  kraft: { name: 'Kraft', bg: '#d6b98c', ink: '#2b1d0e', paint: c => { speckle(c, 1400, 'rgba(90,60,20,.14)', 0, 6, true); speckle(c, 1200, 'rgba(255,255,255,.12)', 2, 7) } },
} satisfies Record<string, Board>

export function drawBoard(ctx: CanvasRenderingContext2D, id: BoardId) {
  const b: Board = BOARDS[id] ?? BOARDS.paper
  ctx.save()
  ctx.fillStyle = b.bg
  ctx.fillRect(0, 0, BW, BH)
  b.paint?.(ctx)
  ctx.restore()
}

export const norm = (e: Rect): Rect => ({ x: Math.min(e.x, e.x + e.w), y: Math.min(e.y, e.y + e.h), w: Math.abs(e.w), h: Math.abs(e.h) })

const tint = (hex: string, a: number) => {
  if (!hex.startsWith('#') || hex.length !== 7) return hex
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

const roughOpts = (e: El, scale = 1): Options => ({
  stroke: e.stroke,
  strokeWidth: e.strokeWidth / scale,
  roughness: e.roughness,
  bowing: 1 + e.roughness,
  seed: e.seed,
  disableMultiStroke: e.roughness === 0,
  disableMultiStrokeFill: e.roughness === 0,
  ...(e.fillStyle !== 'none' && {
    fill: tint(e.fill, e.fillStyle === 'solid' ? 0.42 : 0.68),
    fillStyle: e.fillStyle,
    hachureGap: (e.strokeWidth * 2.5 + 8) / scale,
    hachureAngle: -41 + (e.seed % 24) - 12,
    fillWeight: (e.strokeWidth * 0.7) / scale,
    zigzagOffset: (e.strokeWidth * 2 + 4) / scale,
  }),
})

export const lineHeight = (e: El) => e.fontSize * 1.25

export function measureText(ctx: CanvasRenderingContext2D, e: El) {
  ctx.font = `${e.fontSize}px "${e.font}"`
  const lines = (e.text ?? '').split('\n')
  return { w: Math.max(e.fontSize * 0.5, ...lines.map(l => ctx.measureText(l).width)), h: lines.length * lineHeight(e) }
}

function drawShape(rc: RoughCanvas, s: Shape, o: Options) {
  const opt = 'f' in s && s.f ? o : { ...o, fill: undefined }
  if ('r' in s) rc.rectangle(...s.r, opt)
  else if ('e' in s) rc.ellipse(...s.e, opt)
  else if ('l' in s) rc.linearPath(s.l, opt)
  else if ('g' in s) rc.polygon(s.g, opt)
  else rc.path(s.p, opt)
}

function penPath(e: El) {
  const pts = getStroke((e.points ?? []).map(([x, y]) => [e.x + x, e.y + y]), { size: e.strokeWidth * 2.4, thinning: 0.6, smoothing: 0.5, streamline: 0.4 })
  if (!pts.length) return new Path2D()
  const d = pts.reduce((acc, [x0, y0], i, a) => {
    const [x1, y1] = a[(i + 1) % a.length]
    return acc + ` ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
  }, `M ${pts[0][0]},${pts[0][1]} Q`)
  return new Path2D(d + ' Z')
}

export function drawElement(ctx: CanvasRenderingContext2D, rc: RoughCanvas, e: El) {
  const n = norm(e)
  const o = roughOpts(e)
  switch (e.type) {
    case 'rect': return rc.rectangle(n.x, n.y, n.w, n.h, o)
    case 'ellipse': return rc.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w, n.h, o)
    case 'diamond': return rc.polygon([[n.x + n.w / 2, n.y], [n.x + n.w, n.y + n.h / 2], [n.x + n.w / 2, n.y + n.h], [n.x, n.y + n.h / 2]], o)
    case 'line': return rc.line(e.x, e.y, e.x + e.w, e.y + e.h, o)
    case 'arrow': {
      const ex = e.x + e.w, ey = e.y + e.h
      const a = Math.atan2(e.h, e.w)
      const len = Math.min(30, Math.hypot(e.w, e.h) * 0.35) + e.strokeWidth * 2
      rc.line(e.x, e.y, ex, ey, { ...o, fill: undefined })
      return rc.linearPath([[ex + len * Math.cos(a + 2.6), ey + len * Math.sin(a + 2.6)], [ex, ey], [ex + len * Math.cos(a - 2.6), ey + len * Math.sin(a - 2.6)]], { ...o, fill: undefined })
    }
    case 'pen':
      ctx.fillStyle = e.stroke
      return ctx.fill(penPath(e))
    case 'text': {
      ctx.font = `${e.fontSize}px "${e.font}"`
      ctx.fillStyle = e.stroke
      ctx.textBaseline = 'top'
      return (e.text ?? '').split('\n').forEach((l, i) => ctx.fillText(l, e.x, e.y + i * lineHeight(e)))
    }
    case 'asset': {
      const logo = LOGO_MAP[e.asset ?? '']
      if (logo) {
        const s = Math.min(n.w, n.h) / 24
        ctx.save()
        ctx.translate(n.x + (n.w - s * 24) / 2, n.y + (n.h - s * 24) / 2)
        ctx.scale(s, s)
        ctx.fillStyle = e.stroke
        ctx.fill(logoPath(logo))
        return ctx.restore()
      }
      const asset = ASSET_MAP[e.asset ?? '']
      if (!asset) return
      const s = Math.min(n.w, n.h) / 100
      ctx.save()
      ctx.translate(n.x + (n.w - s * 100) / 2, n.y + (n.h - s * 100) / 2)
      ctx.scale(s, s)
      const so = roughOpts(e, s)
      asset.shapes.forEach(sh => drawShape(rc, sh, so))
      ctx.restore()
    }
  }
}

function segDist(p: P, a: P, b: P) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

export function hitTest(elements: El[], p: P, pad = 10): El | undefined {
  for (let i = elements.length - 1; i >= 0; i--) {
    const e = elements[i]
    if (e.type === 'line' || e.type === 'arrow') {
      if (segDist(p, [e.x, e.y], [e.x + e.w, e.y + e.h]) < pad + e.strokeWidth) return e
      continue
    }
    if (e.type === 'pen') {
      const pts = e.points ?? []
      if (pts.some((q, j) => j > 0 && segDist(p, [e.x + pts[j - 1][0], e.y + pts[j - 1][1]], [e.x + q[0], e.y + q[1]]) < pad + e.strokeWidth)) return e
      continue
    }
    const n = norm(e)
    if (p[0] >= n.x - pad && p[0] <= n.x + n.w + pad && p[1] >= n.y - pad && p[1] <= n.y + n.h + pad) return e
  }
}

export function paintAvatar(c: HTMLCanvasElement, bg: string, photo: HTMLImageElement | null) {
  const ctx = c.getContext('2d')!, S = c.width
  ctx.clearRect(0, 0, S, S)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)
  if (photo) {
    const s = Math.max(S / photo.width, S / photo.height)
    return ctx.drawImage(photo, (S - photo.width * s) / 2, (S - photo.height * s) / 2, photo.width * s, photo.height * s)
  }
  const rc = rough.canvas(c), ink = '#1f1f1f'
  const o: Options = { stroke: ink, strokeWidth: 6, roughness: 1.4, bowing: 2, seed: 11 }
  rc.path('M110 600 Q120 430 300 418 Q480 430 490 600', { ...o, fill: 'rgba(77,171,247,.7)', fillStyle: 'hachure', hachureGap: 16, fillWeight: 3 })
  rc.circle(300, 262, 250, { ...o, fill: '#ffe0bf', fillStyle: 'solid' })
  rc.path('M178 236 Q186 118 300 124 Q420 118 424 244 Q384 168 304 180 Q232 172 178 236 Z', { ...o, fill: ink, fillStyle: 'cross-hatch', hachureGap: 9, fillWeight: 3 })
  rc.circle(214, 318, 44, { stroke: 'none', fill: 'rgba(255,120,120,.45)', fillStyle: 'solid', seed: 3 })
  rc.circle(386, 318, 44, { stroke: 'none', fill: 'rgba(255,120,120,.45)', fillStyle: 'solid', seed: 4 })
  rc.circle(254, 272, 20, { ...o, fill: ink, fillStyle: 'solid' })
  rc.circle(346, 272, 20, { ...o, fill: ink, fillStyle: 'solid' })
  rc.path('M252 326 Q300 368 348 326', o)
}
