export type Pt = [number, number]
export type Shape =
  | { r: [number, number, number, number]; f?: 1 }
  | { e: [number, number, number, number]; f?: 1 }
  | { l: Pt[] }
  | { g: Pt[]; f?: 1 }
  | { p: string; f?: 1 }

export type Asset = { id: string; label: string; group: string; shapes: Shape[] }

const cylinder = (bands: Shape[]): Shape[] => [
  { r: [18, 20, 64, 60], f: 1 },
  { e: [50, 20, 64, 20], f: 1 },
  { p: 'M18 80 A32 10 0 0 0 82 80' },
  ...bands,
]

const radial = (n: number, r1: number, r2: number): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { l: [[50 + Math.cos(a) * r1, 50 + Math.sin(a) * r1], [50 + Math.cos(a) * r2, 50 + Math.sin(a) * r2]] }
  })

const layers: Pt[][] = [[[20, 30], [20, 50], [20, 70]], [[50, 20], [50, 40], [50, 60], [50, 80]], [[80, 38], [80, 62]]]
const net: Shape[] = [
  ...layers.slice(1).flatMap((col, i) => col.flatMap(b => layers[i].map(a => ({ l: [a, b] }) as Shape))),
  ...layers.flat().map(([x, y]) => ({ e: [x, y, 12, 12], f: 1 }) as Shape),
]

const circleMark = (inner: Shape[]): Shape[] => [{ e: [50, 50, 84, 84], f: 1 }, ...inner]

export const ASSETS: Asset[] = [
  { id: 'database', label: 'Database', group: 'Data', shapes: cylinder([{ p: 'M18 40 A32 10 0 0 0 82 40' }, { p: 'M18 60 A32 10 0 0 0 82 60' }]) },
  { id: 'vector-db', label: 'Vector DB', group: 'Data', shapes: cylinder([{ l: [[36, 50], [62, 42], [54, 68], [36, 50]] }, { e: [36, 50, 7, 7], f: 1 }, { e: [62, 42, 7, 7], f: 1 }, { e: [54, 68, 7, 7], f: 1 }]) },
  { id: 'cache', label: 'Cache', group: 'Data', shapes: [{ r: [14, 14, 72, 72], f: 1 }, { g: [[56, 22], [32, 54], [48, 54], [42, 80], [68, 44], [52, 44], [58, 22]] }] },
  { id: 'bucket', label: 'Object storage', group: 'Data', shapes: [{ g: [[18, 28], [82, 28], [72, 90], [28, 90]], f: 1 }, { e: [50, 28, 64, 16] }, { p: 'M24 30 Q50 -4 76 30' }] },
  { id: 'queue', label: 'Queue', group: 'Data', shapes: [{ r: [8, 34, 76, 32], f: 1 }, { l: [[27, 34], [27, 66]] }, { l: [[46, 34], [46, 66]] }, { l: [[65, 34], [65, 66]] }, { l: [[84, 50], [98, 50]] }, { l: [[92, 44], [98, 50], [92, 56]] }] },
  { id: 'file', label: 'File', group: 'Data', shapes: [{ g: [[24, 8], [62, 8], [78, 24], [78, 92], [24, 92]], f: 1 }, { l: [[62, 8], [62, 24], [78, 24]] }, { l: [[34, 44], [68, 44]] }, { l: [[34, 57], [68, 57]] }, { l: [[34, 70], [56, 70]] }] },
  { id: 'layers', label: 'Layers', group: 'Data', shapes: [{ g: [[50, 14], [90, 32], [50, 50], [10, 32]], f: 1 }, { l: [[10, 50], [50, 68], [90, 50]] }, { l: [[10, 68], [50, 86], [90, 68]] }] },

  { id: 'server', label: 'Server', group: 'Compute', shapes: [10, 38, 66].flatMap(y => [{ r: [16, y, 68, 24], f: 1 }, { e: [28, y + 12, 6, 6] }, { l: [[50, y + 12], [74, y + 12]] }] as Shape[]) },
  { id: 'container', label: 'Container', group: 'Compute', shapes: [{ g: [[14, 36], [64, 36], [64, 86], [14, 86]], f: 1 }, { g: [[14, 36], [34, 16], [86, 16], [64, 36]] }, { g: [[64, 36], [86, 16], [86, 66], [64, 86]] }] },
  { id: 'function', label: 'Function', group: 'Compute', shapes: circleMark([{ l: [[34, 26], [44, 26], [66, 76]] }, { l: [[51, 44], [34, 76]] }]) },
  { id: 'chip', label: 'GPU', group: 'Compute', shapes: [{ r: [25, 25, 50, 50], f: 1 }, { r: [38, 38, 24, 24] }, ...[35, 50, 65].flatMap(v => [{ l: [[v, 10], [v, 25]] }, { l: [[v, 75], [v, 90]] }, { l: [[10, v], [25, v]] }, { l: [[75, v], [90, v]] }] as Shape[])] },
  { id: 'terminal', label: 'Terminal', group: 'Compute', shapes: [{ r: [8, 14, 84, 72], f: 1 }, { l: [[8, 30], [92, 30]] }, { l: [[22, 44], [34, 54], [22, 64]] }, { l: [[40, 66], [60, 66]] }] },
  { id: 'laptop', label: 'Laptop', group: 'Compute', shapes: [{ r: [18, 18, 64, 44], f: 1 }, { g: [[14, 62], [86, 62], [94, 76], [6, 76]] }] },

  { id: 'load-balancer', label: 'Load balancer', group: 'Network', shapes: [{ e: [40, 50, 40, 40], f: 1 }, { l: [[2, 50], [20, 50]] }, { l: [[30, 50], [50, 50]] }, { l: [[44, 44], [50, 50], [44, 56]] }, { l: [[58, 38], [94, 16]] }, { l: [[60, 50], [96, 50]] }, { l: [[58, 62], [94, 84]] }] },
  { id: 'globe', label: 'CDN', group: 'Network', shapes: circleMark([{ e: [50, 50, 40, 84] }, { l: [[8, 50], [92, 50]] }, { p: 'M15 30 Q50 38 85 30' }, { p: 'M15 70 Q50 62 85 70' }]) },
  { id: 'cloud', label: 'Cloud', group: 'Network', shapes: [{ p: 'M28 78 C10 78 8 54 26 50 C24 30 50 24 58 38 C66 26 88 32 84 52 C98 56 96 78 78 78 Z', f: 1 }] },
  { id: 'gateway', label: 'API gateway', group: 'Network', shapes: [{ g: [[30, 10], [70, 10], [92, 50], [70, 90], [30, 90], [8, 50]], f: 1 }, { l: [[38, 38], [28, 50], [38, 62]] }, { l: [[62, 38], [72, 50], [62, 62]] }, { l: [[54, 34], [46, 66]] }] },
  { id: 'router', label: 'Router', group: 'Network', shapes: [{ r: [10, 46, 80, 34], f: 1 }, { l: [[30, 46], [22, 14]] }, { l: [[70, 46], [78, 14]] }, { e: [28, 63, 6, 6] }, { e: [42, 63, 6, 6] }, { e: [56, 63, 6, 6] }] },
  { id: 'firewall', label: 'Firewall', group: 'Network', shapes: [{ r: [10, 20, 80, 64], f: 1 }, { l: [[10, 41], [90, 41]] }, { l: [[10, 62], [90, 62]] }, { l: [[50, 20], [50, 41]] }, { l: [[30, 41], [30, 62]] }, { l: [[70, 41], [70, 62]] }, { l: [[50, 62], [50, 84]] }] },
  { id: 'lock', label: 'Auth', group: 'Network', shapes: [{ r: [24, 46, 52, 42], f: 1 }, { p: 'M34 46 V32 A16 16 0 0 1 66 32 V46' }, { e: [50, 62, 9, 9] }, { l: [[50, 66], [50, 76]] }] },
  { id: 'key', label: 'API key', group: 'Network', shapes: [{ e: [28, 50, 32, 32], f: 1 }, { l: [[44, 50], [92, 50]] }, { l: [[80, 50], [80, 63]] }, { l: [[90, 50], [90, 60]] }] },

  { id: 'llm', label: 'LLM', group: 'AI', shapes: [{ p: 'M50 18 C40 6 18 12 20 30 C6 36 8 58 20 62 C16 80 36 90 50 80 C64 90 84 80 80 62 C92 58 94 36 80 30 C82 12 60 6 50 18 Z', f: 1 }, { l: [[50, 18], [50, 80]] }, { p: 'M28 38 Q38 44 32 54' }, { p: 'M72 38 Q62 44 68 54' }, { p: 'M30 66 Q40 62 42 70' }, { p: 'M70 66 Q60 62 58 70' }] },
  { id: 'agent', label: 'Agent', group: 'AI', shapes: [{ r: [22, 30, 56, 46], f: 1 }, { e: [38, 50, 9, 9] }, { e: [62, 50, 9, 9] }, { l: [[40, 64], [60, 64]] }, { l: [[50, 30], [50, 16]] }, { e: [50, 12, 8, 8] }, { r: [12, 44, 10, 18] }, { r: [78, 44, 10, 18] }] },
  { id: 'chat', label: 'Prompt', group: 'AI', shapes: [{ p: 'M12 16 H88 V66 H44 L26 86 V66 H12 Z', f: 1 }, { l: [[24, 32], [76, 32]] }, { l: [[24, 48], [60, 48]] }] },
  { id: 'sparkle', label: 'Magic', group: 'AI', shapes: [{ g: [[46, 8], [54, 42], [88, 50], [54, 58], [46, 92], [38, 58], [6, 50], [38, 42]], f: 1 }, { g: [[80, 8], [83, 17], [92, 20], [83, 23], [80, 32], [77, 23], [68, 20], [77, 17]] }] },
  { id: 'embedding', label: 'Embedding', group: 'AI', shapes: [{ l: [[16, 86], [16, 10]] }, { l: [[16, 86], [92, 86]] }, { l: [[16, 86], [74, 28]] }, { l: [[62, 30], [74, 28], [72, 40]] }, { l: [[16, 86], [84, 62]] }, { l: [[72, 58], [84, 62], [74, 70]] }, { l: [[16, 86], [42, 22]] }, { l: [[34, 28], [42, 22], [46, 34]] }] },
  { id: 'neural-net', label: 'Neural net', group: 'AI', shapes: net },
  { id: 'tokens', label: 'Tokens', group: 'AI', shapes: [{ r: [6, 36, 26, 28], f: 1 }, { r: [37, 36, 26, 28], f: 1 }, { r: [68, 36, 26, 28], f: 1 }, { l: [[12, 50], [26, 50]] }, { l: [[43, 50], [57, 50]] }, { l: [[74, 50], [88, 50]] }] },

  { id: 'browser', label: 'Browser', group: 'Web', shapes: [{ r: [8, 14, 84, 72], f: 1 }, { l: [[8, 30], [92, 30]] }, { e: [17, 22, 5, 5] }, { e: [25, 22, 5, 5] }, { e: [33, 22, 5, 5] }, { l: [[20, 44], [60, 44]] }, { r: [20, 54, 28, 22] }, { l: [[56, 58], [80, 58]] }, { l: [[56, 70], [74, 70]] }] },
  { id: 'mobile', label: 'Mobile', group: 'Web', shapes: [{ r: [30, 6, 40, 88], f: 1 }, { l: [[44, 14], [56, 14]] }, { e: [50, 84, 6, 6] }] },
  { id: 'user', label: 'User', group: 'Web', shapes: [{ e: [50, 32, 30, 30], f: 1 }, { p: 'M20 90 C20 60 80 60 80 90' }] },
  { id: 'team', label: 'Team', group: 'Web', shapes: [{ e: [36, 38, 24, 24], f: 1 }, { p: 'M14 88 C14 62 58 62 58 88' }, { e: [66, 30, 22, 22], f: 1 }, { p: 'M50 58 C58 50 86 50 88 80' }] },
  { id: 'code', label: 'Code', group: 'Web', shapes: [{ r: [8, 18, 84, 64], f: 1 }, { l: [[36, 38], [24, 50], [36, 62]] }, { l: [[64, 38], [76, 50], [64, 62]] }, { l: [[54, 34], [46, 66]] }] },
  { id: 'git', label: 'Git branch', group: 'Web', shapes: [{ l: [[28, 27], [28, 73]] }, { p: 'M72 43 Q72 62 30 64' }, { e: [28, 20, 14, 14], f: 1 }, { e: [28, 80, 14, 14], f: 1 }, { e: [72, 36, 14, 14], f: 1 }] },
  { id: 'mail', label: 'Email', group: 'Web', shapes: [{ r: [10, 24, 80, 52], f: 1 }, { l: [[10, 24], [50, 54], [90, 24]] }] },
  { id: 'search', label: 'Search', group: 'Web', shapes: [{ e: [42, 42, 52, 52], f: 1 }, { l: [[61, 61], [88, 88]] }] },

  { id: 'gear', label: 'Settings', group: 'Symbols', shapes: [...radial(8, 22, 34), { e: [50, 50, 46, 46], f: 1 }, { e: [50, 50, 16, 16] }] },
  { id: 'clock', label: 'Cron', group: 'Symbols', shapes: circleMark([{ l: [[50, 50], [50, 24]] }, { l: [[50, 50], [68, 60]] }]) },
  { id: 'bell', label: 'Notify', group: 'Symbols', shapes: [{ p: 'M30 70 V46 C30 22 70 22 70 46 V70 L78 78 H22 Z', f: 1 }, { p: 'M42 84 Q50 94 58 84' }] },
  { id: 'check', label: 'Success', group: 'Symbols', shapes: circleMark([{ l: [[30, 52], [44, 66], [72, 36]] }]) },
  { id: 'error', label: 'Error', group: 'Symbols', shapes: circleMark([{ l: [[34, 34], [66, 66]] }, { l: [[66, 34], [34, 66]] }]) },
  { id: 'warning', label: 'Warning', group: 'Symbols', shapes: [{ g: [[50, 10], [92, 86], [8, 86]], f: 1 }, { l: [[50, 36], [50, 60]] }, { e: [50, 72, 5, 5] }] },
  { id: 'retry', label: 'Retry', group: 'Symbols', shapes: [{ p: 'M80 40 A32 32 0 1 0 82 62' }, { l: [[68, 40], [81, 40], [81, 27]] }] },
  { id: 'idea', label: 'Idea', group: 'Symbols', shapes: [{ p: 'M36 62 C20 50 22 18 50 16 C78 18 80 50 64 62 V72 H36 Z', f: 1 }, { l: [[38, 80], [62, 80]] }, { l: [[42, 88], [58, 88]] }] },
  { id: 'chart', label: 'Metrics', group: 'Symbols', shapes: [{ l: [[12, 10], [12, 88], [92, 88]] }, { r: [22, 58, 12, 30], f: 1 }, { r: [42, 40, 12, 48], f: 1 }, { r: [62, 24, 12, 64], f: 1 }] },
]

export const ASSET_MAP = Object.fromEntries(ASSETS.map(a => [a.id, a]))
export const ASSET_GROUPS = [...new Set(ASSETS.map(a => a.group))]
