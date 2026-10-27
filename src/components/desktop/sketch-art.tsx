// Pencil-sketch illustrations for the "We help with your PDF tasks" cards,
// drawn to match the reference screenshots: hand-inked strokes, hatch
// shading, sparse green/amber accents on plain white. All deterministic
// (no randomness) so Remotion renders frame 0 identical every time.

const INK = '#2d2a26'
const GRN = '#2f9e63'
const GRN_SOFT = '#cdeadd'
const AMB = '#f0b429'
const MUT = '#9a938c'

const S = {
  fill: 'none',
  stroke: INK,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// deterministic hatch row: n short diagonal strokes starting at x,y
const hatch = (x: number, y: number, n: number, gap = 5, len = 7, key = 'h') => (
  <g key={key} stroke={MUT} strokeWidth={1.4} strokeLinecap="round">
    {Array.from({ length: n }, (_, i) => (
      <line key={i} x1={x + i * gap} y1={y} x2={x + i * gap - len * 0.6} y2={y + len} />
    ))}
  </g>
)

// wobbly hand-drawn rectangle path
const wrect = (x: number, y: number, w: number, h: number, r = 3) =>
  `M${x + r} ${y} q${w * 0.3} -1.5 ${w - r} 0 q1.5 ${h * 0.3} 0 ${h - r} q-${w * 0.3} 1.5 -${w - r} 0 q-1.5 -${h * 0.3} 0 -${h - r} z`

export type ArtProps = { seed?: number }
type Art = React.FC<ArtProps>

/* 1 — Merge: two pages feeding into one monitor, merged output slides out */
export const ArtMerge: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <path d={wrect(56, 34, 88, 62, 6)} {...S} />
    <path d={wrect(64, 44, 72, 42, 3)} {...S} strokeWidth={1.6} />
    {/* merged lines inside screen */}
    <path d="M72 54h34M72 63h50M72 72h42" stroke={GRN} strokeWidth={3.4} strokeLinecap="round" opacity={0.75} />
    <path d="M72 80h56" {...S} strokeWidth={1.4} />
    {/* two source pages top-left, arrows into screen */}
    <path d={wrect(18, 24, 26, 34, 2)} {...S} strokeWidth={1.7} />
    <path d="M24 33h14M24 40h14M24 47h9" stroke={MUT} strokeWidth={1.4} strokeLinecap="round" />
    <path d={wrect(26, 66, 24, 30, 2)} {...S} strokeWidth={1.7} />
    <path d="M32 75h12M32 82h12M32 89h7" stroke={MUT} strokeWidth={1.4} strokeLinecap="round" />
    <path d="M46 46c8 2 10 8 11 16M52 88c4-4 5-10 6-18" {...S} strokeWidth={1.6} />
    <path d="M55 58l2 6 5-3M58 80l1-6 5 4" {...S} strokeWidth={1.6} />
    {/* output page right */}
    <path d={wrect(150, 46, 30, 40, 2)} {...S} strokeWidth={1.7} />
    <path d="M157 57h16M157 65h16M157 73h10" stroke={GRN} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
    <path d="M146 66c-2 0-3 0-4 0M148 60l-4 6 4 6" {...S} strokeWidth={1.7} />
    {/* stand + desk */}
    <path d="M96 96v14M80 112h34" {...S} />
    <path d="M28 124h140" {...S} strokeWidth={2.2} />
    {hatch(36, 126, 8, 7, 6, 'hm')}
    {hatch(140, 128, 6, 7, 5, 'hr')}
    {/* coffee cup */}
    <path d={wrect(160, 106, 18, 14, 2)} {...S} strokeWidth={1.7} />
    <path d="M178 109c5 0 5 7 0 7" {...S} strokeWidth={1.5} />
    <path d="M164 100c1-2-1-3 0-5M171 100c1-2-1-3 0-5" stroke={MUT} strokeWidth={1.3} strokeLinecap="round" fill="none" />
  </svg>
)

/* 2 — Split: single document cut along a dashed line into two pages */
export const ArtSplit: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    {/* source page */}
    <path d={wrect(30, 26, 56, 74, 4)} {...S} />
    <path d="M40 40h34M40 50h36M40 60h30M40 70h36M40 80h22" stroke={MUT} strokeWidth={1.5} strokeLinecap="round" />
    {/* cut line */}
    <path d="M92 22v92" stroke={GRN} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="7 6" />
    {/* scissors hint */}
    <circle cx="92" cy="120" r="4.5" {...S} strokeWidth={1.7} />
    <circle cx="101" cy="124" r="4.5" {...S} strokeWidth={1.7} />
    <path d="M95 117l16-22M99 122l18-16" {...S} strokeWidth={1.7} />
    {/* two result pages */}
    <path d={wrect(120, 30, 30, 40, 2)} {...S} strokeWidth={1.7} />
    <path d="M127 41h16M127 49h16M127 57h10" stroke={MUT} strokeWidth={1.4} strokeLinecap="round" />
    <path d={wrect(140, 78, 30, 40, 2)} {...S} strokeWidth={1.7} />
    <path d="M147 89h16M147 97h16M147 105h10" stroke={GRN} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
    {/* motion arrows */}
    <path d="M104 46h10M110 42l4 4-4 4M104 96h10M110 92l4 4-4 4" {...S} strokeWidth={1.6} />
    <path d="M22 118h150" {...S} strokeWidth={2.2} />
    {hatch(30, 120, 8, 7, 6, 'sp')}
    {hatch(138, 122, 6, 7, 5, 'sr')}
  </svg>
)

/* 3 — Convert: PDF flying through cloud arrows into Word / image outputs */
export const ArtConvert: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    {/* source pdf */}
    <path d={wrect(24, 40, 34, 44, 3)} {...S} strokeWidth={1.8} />
    <path d="M31 52h20M31 60h20M31 68h13" stroke={MUT} strokeWidth={1.4} strokeLinecap="round" />
    <text x="30" y="83" fontSize="10" fontWeight="700" fill={INK} fontFamily="inherit">PDF</text>
    {/* cloud */}
    <path d="M96 34c-10 0-16 6-15 13-7 1-10 6-10 11 0 6 5 10 12 10h34c8 0 13-4 13-10 0-6-4-10-10-11 1-8-8-14-24-13z" {...S} strokeWidth={1.8} />
    {hatch(80, 60, 5, 6, 5, 'cm')}
    {/* arrows through cloud */}
    <path d="M64 66h28M88 60l6 6-6 6" {...S} strokeWidth={2} />
    {/* outputs: W doc + image doc */}
    <path d={wrect(128, 52, 34, 44, 3)} {...S} strokeWidth={1.8} />
    <path d="M136 66l3 14 4-9 4 9 3-14" stroke={GRN} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={wrect(128, 8, 34, 36, 3)} {...S} strokeWidth={1.8} />
    <rect x="134" y="15" width="22" height="15" rx="2" fill={GRN_SOFT} stroke={INK} strokeWidth={1.6} />
    <path d="M136 27l5-6 4 4 4-6 5 8" stroke={GRN} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* downward flow dashes */}
    <path d="M96 74v18M92 88l4 5 4-5" {...S} strokeWidth={1.7} />
    <path d={wrect(66, 96, 62, 10, 3)} {...S} strokeWidth={1.6} />
    <path d="M74 101h46" stroke={MUT} strokeWidth={1.4} strokeLinecap="round" />
    <path d="M24 122h150" {...S} strokeWidth={2.2} />
    {hatch(32, 124, 7, 7, 6, 'vm')}
  </svg>
)

/* 4 — Compress: big document squeezed by arrows into a small one */
export const ArtCompress: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    {/* big doc */}
    <path d={wrect(52, 22, 52, 70, 4)} {...S} />
    <path d="M62 36h30M62 46h32M62 56h26M62 66h32M62 76h18" stroke={MUT} strokeWidth={1.5} strokeLinecap="round" />
    {/* squeeze arrows */}
    <path d="M118 40c14 4 16 30 0 36M120 44l-3-6 7 1M120 72l-3 6 7-1" {...S} strokeWidth={1.8} />
    <path d="M36 40c-14 4-16 30 0 36M34 44l3-6-7 1M34 72l3 6-7-1" {...S} strokeWidth={1.8} />
    {/* down arrow to small doc */}
    <path d="M80 98v14M74 106l6 7 6-7" stroke={GRN} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* small doc */}
    <path d={wrect(62, 118, 40, 22, 3)} {...S} strokeWidth={1.8} />
    <path d="M70 126h24M70 132h16" stroke={GRN} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
    {/* gauge */}
    <path d="M136 96a24 24 0 0148 0" {...S} strokeWidth={1.8} />
    <path d="M160 96l10-12" stroke={AMB} strokeWidth={2.6} strokeLinecap="round" />
    <circle cx="160" cy="96" r="3" fill={INK} />
    <path d="M136 96h-5M184 96h5M144 82l-4-4M176 82l4-4" {...S} strokeWidth={1.5} />
    {hatch(132, 120, 9, 7, 6, 'cp')}
    <path d="M22 122h150" {...S} strokeWidth={2.2} />
  </svg>
)

/* 5 — Edit: pencil actively writing on a document */
export const ArtEdit: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <path d={wrect(44, 22, 72, 96, 4)} {...S} />
    {/* text lines, last one being written in green */}
    <path d="M54 38h48M54 50h52M54 62h44M54 74h52" stroke={MUT} strokeWidth={1.5} strokeLinecap="round" />
    <path d="M54 88c8-4 14 2 22 0s12-3 18 0" stroke={GRN} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    {/* pencil */}
    <path d="M138 34L96 92l-6 14 14-6 42-58z" {...S} strokeWidth={1.9} />
    <path d="M128 48l12 9" {...S} strokeWidth={1.6} />
    <path d="M96 92l8 6" {...S} strokeWidth={1.6} />
    <path d="M90 106l2-4 4 2z" fill={INK} />
    {/* sparkle marks */}
    <path d="M136 22l3-6M146 30l6-3M150 44l6 1" stroke={AMB} strokeWidth={2} strokeLinecap="round" />
    {/* cursor */}
    <path d="M78 96l10 4-4 2-2 4z" fill={INK} stroke="#fff" strokeWidth={0.8} />
    <path d="M30 128h140" {...S} strokeWidth={2.2} />
    {hatch(38, 130, 8, 7, 6, 'em')}
    {hatch(136, 132, 6, 7, 5, 'er')}
  </svg>
)

/* 6 — Protect: monitor with green padlock, shield hatching behind */
export const ArtProtect: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    {/* shield hatch backdrop */}
    <path d="M100 14c26 8 40 10 52 10-2 34-12 62-52 78-40-16-50-44-52-78 12 0 26-2 52-10z" {...S} strokeWidth={1.6} opacity={0.35} />
    {/* monitor */}
    <path d={wrect(52, 30, 96, 64, 6)} {...S} />
    <path d={wrect(60, 38, 80, 48, 3)} {...S} strokeWidth={1.5} />
    <path d="M100 94v12M84 110h34" {...S} />
    {/* padlock */}
    <rect x="86" y="52" width="28" height="22" rx="4" fill={GRN_SOFT} stroke={INK} strokeWidth={2} />
    <path d="M91 52v-6a9 9 0 0118 0v6" {...S} strokeWidth={2} />
    <circle cx="100" cy="61" r="3.4" fill={GRN} />
    <path d="M100 64v5" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    {/* key + stars */}
    <path d="M150 44h20M166 40v8M160 44v0" {...S} strokeWidth={1.7} />
    <circle cx="156" cy="44" r="4" {...S} strokeWidth={1.7} />
    <path d="M148 78l2.5-5 2.5 5M154 70l2.5-5 2.5 5" stroke={AMB} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    <path d="M28 124h144" {...S} strokeWidth={2.2} />
    {hatch(36, 126, 8, 7, 6, 'pm')}
    {hatch(138, 128, 6, 7, 5, 'pr')}
  </svg>
)

/* 7 — Watermark: document, pencil, ruler and gear — stamped watermark band */
export const ArtWatermark: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <path d={wrect(58, 18, 70, 94, 4)} {...S} />
    {/* watermark band behind text */}
    <path d="M52 60l82-20" stroke={GRN} strokeWidth={9} strokeLinecap="round" opacity={0.32} />
    <path d="M66 34h46M66 46h50M66 76h50M66 88h38" stroke={MUT} strokeWidth={1.5} strokeLinecap="round" />
    {/* ruler */}
    <path d={wrect(134, 30, 12, 74, 2)} {...S} strokeWidth={1.7} />
    <path d="M136 40h6M136 50h6M136 60h6M136 70h6M136 80h6M136 90h6" stroke={MUT} strokeWidth={1.3} strokeLinecap="round" />
    {/* pencil small */}
    <path d="M150 84l24-30 8 6-24 30-10 4z" {...S} strokeWidth={1.7} />
    <path d="M168 60l8 6" {...S} strokeWidth={1.4} />
    {/* gear */}
    <circle cx="40" cy="112" r="10" {...S} strokeWidth={1.7} />
    <circle cx="40" cy="112" r="3.5" {...S} strokeWidth={1.5} />
    <path d="M40 98v6M40 120v6M26 112h6M48 112h6M30 102l4 4M46 118l4 4M50 102l-4 4M34 118l-4 4" {...S} strokeWidth={1.6} />
    <path d="M26 126h148" {...S} strokeWidth={2.2} />
    {hatch(34, 128, 8, 7, 6, 'wm')}
  </svg>
)

/* 8 — Grayscale: browser window, images losing their colour */
export const ArtGrayscale: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <path d={wrect(34, 26, 132, 84, 6)} {...S} />
    {/* browser chrome */}
    <path d="M34 42h132" {...S} strokeWidth={1.7} />
    <circle cx="44" cy="34" r="2.4" fill={INK} />
    <circle cx="52" cy="34" r="2.4" fill={MUT} />
    <circle cx="60" cy="34" r="2.4" fill={MUT} />
    {/* colour image fading to gray, split by arrow */}
    <rect x="46" y="52" width="40" height="30" rx="3" fill={GRN_SOFT} stroke={INK} strokeWidth={1.7} />
    <path d="M50 78l9-12 7 8 6-9 9 13" stroke={GRN} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="76" cy="60" r="3.4" fill={AMB} />
    <path d="M104 58h16M114 54l6 4-6 4" {...S} strokeWidth={1.7} />
    <rect x="128" y="52" width="30" height="30" rx="3" fill="#e8e6e2" stroke={INK} strokeWidth={1.7} />
    <path d="M132 78l8-11 6 7 5-8 7 12" stroke={MUT} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* text lines turning gray */}
    <path d="M46 96h64" stroke={GRN} strokeWidth={2.6} strokeLinecap="round" opacity={0.75} />
    <path d="M118 96h42" stroke={MUT} strokeWidth={2.6} strokeLinecap="round" />
    {/* half-tone circle */}
    <circle cx="100" cy="124" r="12" {...S} strokeWidth={1.7} />
    <path d="M100 112a12 12 0 010 24z" fill={MUT} opacity={0.5} />
    <path d="M24 126h50M126 126h50" {...S} strokeWidth={2.2} />
  </svg>
)

/* 9 — Crop: page inside crop marks, corner handles, circular lens */
export const ArtCrop: Art = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    {/* page */}
    <path d={wrect(58, 24, 78, 92, 4)} {...S} />
    <path d="M68 38h52M68 50h58M68 62h44" stroke={MUT} strokeWidth={1.5} strokeLinecap="round" />
    {/* crop frame */}
    <path d="M48 40v64a8 8 0 008 8h64" stroke={GRN} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    <path d="M40 40h16M48 32v16M120 104h16M128 96v16" stroke={GRN} strokeWidth={2.4} strokeLinecap="round" />
    {/* lens circle accent */}
    <circle cx="128" cy="46" r="17" {...S} strokeWidth={1.8} />
    <circle cx="128" cy="46" r="11" fill={GRN_SOFT} stroke={INK} strokeWidth={1.4} />
    <path d="M122 46c4-5 8-5 12 0" stroke={GRN} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    <path d="M141 59l12 12" {...S} strokeWidth={2.2} />
    {/* hatch shading outside crop */}
    {hatch(34, 112, 7, 6, 6, 'cm2')}
    <path d="M24 126h152" {...S} strokeWidth={2.2} />
    {hatch(140, 128, 6, 7, 5, 'cr')}
  </svg>
)

export const SKETCH_ART: Record<string, Art> = {
  Merge: ArtMerge,
  'Split by pages': ArtSplit,
  'PDF to Word': ArtConvert,
  Compress: ArtCompress,
  'PDF Editor': ArtEdit,
  Protect: ArtProtect,
  Watermark: ArtWatermark,
  Grayscale: ArtGrayscale,
  Crop: ArtCrop,
}
