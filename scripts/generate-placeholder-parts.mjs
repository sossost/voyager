// 기하 도형 placeholder 파츠 생성기 — 실아트가 같은 파일명으로 교체될 때까지의 임시 에셋.
// 모든 파츠는 viewBox 0 0 200 200을 공유하고 CSS 변수(--alien-*)로 채색된다 (결정 17).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'assets-src', 'parts')
mkdirSync(OUT_DIR, { recursive: true })

const pad = (n) => String(n).padStart(2, '0')
const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n${inner}\n</svg>\n`

const PRIMARY = 'var(--alien-primary)'
const SECONDARY = 'var(--alien-secondary)'
const ACCENT = 'var(--alien-accent)'

const files = new Map()

// ── body 12종: 중앙을 차지하는 몸통 ──────────────────────────
for (let i = 1; i <= 12; i++) {
  const stroke = `fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="5"`
  const variant = i % 6
  let shape
  if (variant === 0) shape = `<circle cx="100" cy="105" r="${56 + (i % 3) * 6}" ${stroke}/>`
  else if (variant === 1) shape = `<ellipse cx="100" cy="105" rx="50" ry="${66 + (i % 3) * 4}" ${stroke}/>`
  else if (variant === 2) shape = `<ellipse cx="100" cy="108" rx="${66 + (i % 3) * 4}" ry="50" ${stroke}/>`
  else if (variant === 3) shape = `<rect x="42" y="48" width="116" height="112" rx="${26 + (i % 3) * 8}" ${stroke}/>`
  else if (variant === 4)
    shape = `<polygon points="100,40 162,86 138,162 62,162 38,86" ${stroke} stroke-linejoin="round"/>`
  else
    shape = `<polygon points="100,38 156,70 156,138 100,170 44,138 44,70" ${stroke} stroke-linejoin="round"/>`
  files.set(`body${pad(i)}.svg`, svg(shape))
}

// ── eyes 16종: 외눈/두눈 변형 ────────────────────────────────
for (let i = 1; i <= 16; i++) {
  let inner
  if (i % 4 === 0) {
    const r = 17 + (i % 3) * 4
    inner =
      `<circle cx="100" cy="92" r="${r}" fill="#ffffff" stroke="${SECONDARY}" stroke-width="4"/>` +
      `<circle cx="100" cy="92" r="${Math.round(r / 2)}" fill="${SECONDARY}"/>`
  } else {
    const gap = 24 + (i % 5) * 6
    const r = 10 + (i % 4) * 3
    const pupil = i % 2 === 0 ? ACCENT : SECONDARY
    inner =
      `<circle cx="${100 - gap}" cy="90" r="${r}" fill="#ffffff" stroke="${SECONDARY}" stroke-width="3"/>` +
      `<circle cx="${100 + gap}" cy="90" r="${r}" fill="#ffffff" stroke="${SECONDARY}" stroke-width="3"/>` +
      `<circle cx="${100 - gap}" cy="90" r="${Math.max(3, r - 6)}" fill="${pupil}"/>` +
      `<circle cx="${100 + gap}" cy="90" r="${Math.max(3, r - 6)}" fill="${pupil}"/>`
  }
  files.set(`eyes${pad(i)}.svg`, svg(inner))
}

// ── mouth 12종 ───────────────────────────────────────────────
for (let i = 1; i <= 12; i++) {
  const stroke = `stroke="${SECONDARY}" stroke-width="5" fill="none" stroke-linecap="round"`
  const variant = i % 6
  let inner
  if (variant === 0) inner = `<path d="M 78 126 Q 100 ${138 + (i % 3) * 6} 122 126" ${stroke}/>`
  else if (variant === 1) inner = `<path d="M 78 134 Q 100 ${122 - (i % 3) * 4} 122 134" ${stroke}/>`
  else if (variant === 2) inner = `<ellipse cx="100" cy="130" rx="${10 + (i % 3) * 4}" ry="${12 + (i % 2) * 5}" fill="${SECONDARY}"/>`
  else if (variant === 3) inner = `<line x1="${88 - (i % 3) * 4}" y1="130" x2="${112 + (i % 3) * 4}" y2="130" ${stroke}/>`
  else if (variant === 4) inner = `<polyline points="80,128 90,136 100,128 110,136 120,128" ${stroke}/>`
  else inner = `<circle cx="100" cy="130" r="${7 + (i % 3) * 3}" fill="${SECONDARY}"/>`
  files.set(`mouth${pad(i)}.svg`, svg(inner))
}

// ── appendage 14종: 더듬이/뿔/귀 ─────────────────────────────
for (let i = 1; i <= 14; i++) {
  const variant = i % 3
  const spread = 14 + (i % 4) * 5
  let inner
  if (variant === 0) {
    inner =
      `<line x1="${100 - spread}" y1="52" x2="${92 - spread}" y2="${22 - (i % 3) * 4}" stroke="${SECONDARY}" stroke-width="5" stroke-linecap="round"/>` +
      `<line x1="${100 + spread}" y1="52" x2="${108 + spread}" y2="${22 - (i % 3) * 4}" stroke="${SECONDARY}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="${92 - spread}" cy="${20 - (i % 3) * 4}" r="8" fill="${ACCENT}"/>` +
      `<circle cx="${108 + spread}" cy="${20 - (i % 3) * 4}" r="8" fill="${ACCENT}"/>`
  } else if (variant === 1) {
    inner =
      `<polygon points="${72 - (i % 3) * 4},58 ${58 - (i % 3) * 6},${24 - (i % 2) * 6} ${90 - (i % 3) * 4},44" fill="${SECONDARY}"/>` +
      `<polygon points="${128 + (i % 3) * 4},58 ${142 + (i % 3) * 6},${24 - (i % 2) * 6} ${110 + (i % 3) * 4},44" fill="${SECONDARY}"/>`
  } else {
    inner =
      `<ellipse cx="${52 - (i % 3) * 3}" cy="96" rx="14" ry="${24 + (i % 3) * 6}" fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="4"/>` +
      `<ellipse cx="${148 + (i % 3) * 3}" cy="96" rx="14" ry="${24 + (i % 3) * 6}" fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="4"/>`
  }
  files.set(`app${pad(i)}.svg`, svg(inner))
}

// ── pattern 10종: 몸통 위 무늬 ───────────────────────────────
for (let i = 1; i <= 10; i++) {
  const variant = i % 5
  let inner
  if (variant === 0)
    inner = [0, 1, 2].map((k) => `<circle cx="${78 + k * 22}" cy="${112 + (k % 2) * 14}" r="6" fill="${ACCENT}" opacity="0.65"/>`).join('')
  else if (variant === 1)
    inner = [0, 1].map((k) => `<rect x="64" y="${106 + k * 18}" width="72" height="7" rx="3.5" fill="${ACCENT}" opacity="0.6"/>`).join('')
  else if (variant === 2)
    inner = `<polygon points="100,98 106,112 121,112 109,121 113,136 100,127 87,136 91,121 79,112 94,112" fill="${ACCENT}" opacity="0.75"/>`
  else if (variant === 3)
    inner = `<circle cx="100" cy="116" r="${16 + (i % 3) * 5}" fill="none" stroke="${ACCENT}" stroke-width="5" opacity="0.6"/>`
  else
    inner = [0, 1, 2, 3].map((k) => `<circle cx="${72 + k * 19}" cy="148" r="4.5" fill="${ACCENT}" opacity="0.7"/>`).join('')
  files.set(`pat${pad(i)}.svg`, svg(inner))
}

for (const [name, content] of files) {
  writeFileSync(join(OUT_DIR, name), content)
}
console.log(`generated ${files.size} placeholder part SVGs → assets-src/parts/`)
