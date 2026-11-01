// Types for the per-tool guide content extracted from the reference
// prototype's tools.json (see src/data/tool-guides.json).

export type GuideTip = ['tip', string]

export type GuideStep = {
  h?: string
  paras?: string[]
  items?: (string | GuideTip)[]
  subs?: { h: string; paras: string[] }[]
}

export type Guide = {
  h: string
  sub?: string
  steps: GuideStep[]
  cta?: string
}

export type ToolInfo = {
  name: string
  title: string
  sub: string
  badge: string
  free: string
  // Optional pill lines under the hero sub (prototype "pre" field,
  // e.g. "or start with a blank document" on the PDF editor page).
  pre?: string[]
  guides: Guide[]
}

// Compress-guide mockup highlighting, same mapping as the prototype.
export const MOCK: Record<string, [string, string, number]> = {
  'Configure image quality': ['q', 'Good', 0],
  'Image resolution (PPI)': ['ppi', '', 0],
  'Faster PDF compression': ['speed', '', 1],
  'Grayscale images': ['conv', '', 0],
}

export const SEG_ROWS: [string, string, (string | number)[]][] = [
  ['q', 'Image quality:', ['Medium', 'Good', 'Best']],
  ['ppi', 'Image resolution (ppi):', [72, 100, 144, 200, 300, 720]],
  ['conv', 'Image conversion:', ['None', 'Grayscale']],
  ['media', 'Multimedia files:', ['Discard', 'Keep']],
]

export const SEG_ADV: [string, string, (string | number)[]][] = [
  ['speed', 'Compression speed:', ['Regular', 'Faster']],
  ['meta', 'Metadata:', ['Keep', 'Remove']],
]

export const TIPS: Record<string, string> = {
  Medium: 'Smallest size, fine for screens',
  Good: 'Balanced quality and size',
  Best: 'Highest quality, larger file',
  Grayscale: 'Convert color images to grayscale',
  Discard: 'Remove embedded audio and video',
  Optimize: 'Remove unused font data (experimental)',
  Faster: 'Skip smaller images, compress only the large ones',
  Regular: 'Process every image',
  Remove: 'Strip title, author and other metadata',
}
