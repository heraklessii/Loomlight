// Loomlight's own icon set: 24-unit grid, 1.75 stroke, square-ish joins so
// they sit well next to pixel art. Colour comes from `currentColor`.

import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

const make = (children: ReactNode) => (p: IconProps) => <Svg {...p}>{children}</Svg>

export const Icons = {
  pencil: make(
    <>
      <path d="M4 20l1.2-4.6L15.6 5a2.1 2.1 0 013 3L8.2 18.4 4 20z" />
      <path d="M13.6 7l3.4 3.4" />
    </>
  ),
  eraser: make(
    <>
      <path d="M8.5 19.5l-3.8-3.8a2 2 0 010-2.8l8.4-8.4a2 2 0 012.8 0l3.6 3.6a2 2 0 010 2.8l-8.6 8.6z" />
      <path d="M9 9l6 6" />
      <path d="M12 19.5h8" />
    </>
  ),
  bucket: make(
    <>
      <path d="M4.6 11.2L11 4.8l7.4 7.4-5.9 5.9a2 2 0 01-2.8 0l-5.1-5.1a1.2 1.2 0 010-1.8z" />
      <path d="M4.5 12h14" />
      <path d="M20 15.5s1.6 2.1 1.6 3.2a1.6 1.6 0 01-3.2 0c0-1.1 1.6-3.2 1.6-3.2z" />
    </>
  ),
  eyedropper: make(
    <>
      <path d="M14.2 6.2l1.9-1.9a2.3 2.3 0 013.3 3.3l-1.9 1.9" />
      <path d="M12.6 4.8l6.6 6.6" />
      <path d="M15.5 9.9L7.2 18.2 4 20l1.8-3.2 8.3-8.3" />
    </>
  ),
  line: make(<path d="M4 20h3v-3h3v-3h3v-3h3V8h3V4" />),
  rectangle: make(<rect x="4" y="6" width="16" height="12" rx="1" />),
  ellipse: make(<ellipse cx="12" cy="12" rx="8.5" ry="6.5" />),
  move: make(
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5" />
    </>
  ),
  hand: make(
    <path d="M8 13V6a1.5 1.5 0 013 0v5M11 10.5V4.5a1.5 1.5 0 013 0V11M14 10.5V6a1.5 1.5 0 013 0v5M17 10V8.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1.2a6 6 0 01-4.9-2.6L4.3 14.6a1.6 1.6 0 012.5-2L8 14" />
  ),
  play: make(<path d="M7.5 5v14l11-7z" fill="currentColor" />),
  pause: make(
    <>
      <rect x="6.5" y="5" width="3.5" height="14" rx="0.8" fill="currentColor" />
      <rect x="14" y="5" width="3.5" height="14" rx="0.8" fill="currentColor" />
    </>
  ),
  prev: make(<path d="M15 6l-6 6 6 6" />),
  next: make(<path d="M9 6l6 6-6 6" />),
  first: make(<path d="M6.5 5.5v13M17 6l-6 6 6 6" />),
  last: make(<path d="M17.5 5.5v13M7 6l6 6-6 6" />),
  onion: make(
    <>
      <rect x="3" y="8" width="10" height="10" rx="1" opacity="0.35" />
      <rect x="7" y="6" width="10" height="10" rx="1" opacity="0.6" />
      <rect x="11" y="4" width="10" height="10" rx="1" />
    </>
  ),
  plus: make(<path d="M12 5v14M5 12h14" />),
  minus: make(<path d="M5 12h14" />),
  trash: make(
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7" />
      <path d="M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5" />
    </>
  ),
  eye: make(
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: make(
    <>
      <path d="M10 5.7A9 9 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.6 3.4M6.2 7.4A15.6 15.6 0 002.5 12s3.5 6.5 9.5 6.5a9 9 0 004.4-1.1" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
  lock: make(
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  unlock: make(
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="1.5" />
      <path d="M8 11V8a4 4 0 017.6-1.8" />
    </>
  ),
  grid: make(<path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" />),
  mirrorH: make(
    <>
      <path d="M12 3v18" strokeDasharray="2 2.5" />
      <path d="M9 7.5L4 12l5 4.5z" />
      <path d="M15 7.5l5 4.5-5 4.5z" fill="currentColor" />
    </>
  ),
  mirrorV: make(
    <>
      <path d="M3 12h18" strokeDasharray="2 2.5" />
      <path d="M7.5 9L12 4l4.5 5z" />
      <path d="M7.5 15l4.5 5 4.5-5z" fill="currentColor" />
    </>
  ),
  brushSquare: make(<rect x="7" y="7" width="10" height="10" rx="0.5" fill="currentColor" stroke="none" />),
  brushRound: make(<circle cx="12" cy="12" r="5.5" fill="currentColor" stroke="none" />),
  pixelPerfect: make(
    <>
      <rect x="4" y="15" width="5" height="5" fill="currentColor" stroke="none" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" stroke="none" />
      <rect x="15" y="4" width="5" height="5" fill="currentColor" stroke="none" />
    </>
  ),
  filled: make(
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1" />
      <rect x="7.5" y="7.5" width="9" height="9" fill="currentColor" stroke="none" />
    </>
  ),
  contiguous: make(
    <>
      <rect x="4" y="4" width="7" height="7" fill="currentColor" stroke="none" />
      <rect x="11" y="4" width="7" height="7" fill="currentColor" stroke="none" opacity="0.6" />
      <rect x="11" y="11" width="7" height="7" fill="currentColor" stroke="none" />
      <rect x="4" y="13" width="5" height="5" rx="0.5" />
    </>
  ),
  undo: make(<path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />),
  redo: make(<path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13" />),
  search: make(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  export: make(<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14v5.5h14V14" />),
  folder: make(<path d="M3 6.5A1.5 1.5 0 014.5 5H9l2 2.2h8.5A1.5 1.5 0 0121 8.7v9.8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z" />),
  fileNew: make(
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M12 11v6M9 14h6" />
    </>
  ),
  save: make(
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8.5 4v4.5h6V4M8 20v-6h8v6" />
    </>
  ),
  duplicate: make(
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8" />
    </>
  ),
  layers: make(
    <>
      <path d="M12 4l9 5-9 5-9-5z" />
      <path d="M3 14l9 5 9-5" />
    </>
  ),
  swap: make(<path d="M15 4l4 4-4 4M19 8H8M9 20l-4-4 4-4M5 16h11" />),
  chevronDown: make(<path d="M6 9l6 6 6-6" />),
  close: make(<path d="M6 6l12 12M18 6L6 18" />),
  check: make(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  globe: make(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5s1.1-6.1 3.6-8.5z" />
    </>
  ),
  marquee: make(<rect x="4" y="5" width="16" height="14" rx="0.5" strokeDasharray="3 2.6" />),
  lasso: make(
    <>
      <path d="M7.5 15.5C4.8 14.6 3.5 12.9 3.5 11c0-3.6 3.8-6.5 8.5-6.5s8.5 2.9 8.5 6.5-3.8 6.5-8.5 6.5c-.9 0-1.8-.1-2.6-.3" strokeDasharray="3 2.4" />
      <path d="M9.4 17.2c-.3 1.6-1.3 2.8-3.4 3.3" />
      <circle cx="8.6" cy="16.2" r="1.4" />
    </>
  ),
  wand: make(
    <>
      <path d="M4 20L14.5 9.5" />
      <path d="M13 8l3 3" />
      <path d="M17.5 3.5v2.5M17.5 9v2.5M13.5 7.5h-1M23 7.5h-2.5M20.3 4.7l-1.4 1.4M14.7 4.7l1.4 1.4M20.3 10.3l-1.4-1.4" />
    </>
  ),
  copy: make(
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8" />
    </>
  ),
  paste: make(
    <>
      <path d="M9 4.5H6.5A1.5 1.5 0 005 6v13.5A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H15" />
      <rect x="9" y="3" width="6" height="3.5" rx="1" />
    </>
  ),
  flipH: make(
    <>
      <path d="M12 3v18" strokeDasharray="2 2.5" />
      <path d="M9 6L3.5 18H9z" />
      <path d="M15 6l5.5 12H15z" fill="currentColor" />
    </>
  ),
  flipV: make(
    <>
      <path d="M3 12h18" strokeDasharray="2 2.5" />
      <path d="M6 9L18 3.5V9z" />
      <path d="M6 15l12 5.5V15z" fill="currentColor" />
    </>
  ),
  crop: make(<path d="M6 2.5V18h15.5M2.5 6H18v15.5" />),
  resize: make(
    <>
      <rect x="3.5" y="9.5" width="11" height="11" rx="1" />
      <path d="M13 4h7v7M20 4l-7.5 7.5" />
    </>
  ),
  rotateCW: make(
    <>
      <path d="M20 12a8 8 0 11-2.4-5.7" />
      <path d="M20.5 4v4.5H16" />
    </>
  ),
  rotateCCW: make(
    <>
      <path d="M4 12a8 8 0 102.4-5.7" />
      <path d="M3.5 4v4.5H8" />
    </>
  ),
  tag: make(
    <>
      <path d="M3.5 11.6V4.5a1 1 0 011-1h7.1a1 1 0 01.7.3l8.4 8.4a1 1 0 010 1.4l-7.1 7.1a1 1 0 01-1.4 0L3.8 12.3a1 1 0 01-.3-.7z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  clock: make(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  merge: make(<path d="M7 4v4.5a3.5 3.5 0 003.5 3.5H12M17 4v4.5a3.5 3.5 0 01-3.5 3.5H12m0 0v8M8.5 16.5L12 20l3.5-3.5" />)
}

export type IconName = keyof typeof Icons

/** The woven pixel mark: a 4×4 weave of amber warp and light weft. */
export function LogoMark({ size = 20 }: { size?: number }) {
  const cells = []
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const warp = (x + y) % 2 === 0
      cells.push(<rect key={`${x}${y}`} x={x * 5} y={y * 5} width={4} height={4} rx={0.6} className={warp ? 'logo-warp' : 'logo-weft'} />)
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 19 19" aria-hidden="true" shapeRendering="geometricPrecision">
      {cells}
    </svg>
  )
}
