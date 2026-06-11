// 파츠 빌드 파이프라인: assets-src/parts/*.svg → (svgo) → @svgr/cli 타입드 컴포넌트
// → src/assets/parts/ + 매니페스트 자동 생성 (결정 17).
// 실아트 교체도 같은 명령 한 번이다: npm run build:parts
import { execSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'assets-src', 'parts')
const OUT_DIR = join(ROOT, 'src', 'assets', 'parts')

// 1) svgo 최적화 + SVGR 타입드 React 컴포넌트 변환
execSync(
  [
    'npx @svgr/cli',
    '--typescript',
    '--jsx-runtime automatic',
    '--no-dimensions', // width/height 제거 — 카드 컨테이너가 크기를 결정
    `--out-dir "${OUT_DIR}"`,
    `-- "${SRC_DIR}"`,
  ].join(' '),
  { cwd: ROOT, stdio: 'inherit' },
)

// 2) 매니페스트 생성 — 슬롯·z순서 메타 + partId → 컴포넌트 매핑
const partFiles = readdirSync(SRC_DIR)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => file.replace(/\.svg$/, ''))
  .sort()

const componentNameOf = (partId) => partId.charAt(0).toUpperCase() + partId.slice(1)

const imports = partFiles
  .map((partId) => `import ${componentNameOf(partId)} from './${componentNameOf(partId)}'`)
  .join('\n')

const entries = partFiles
  .map((partId) => `  ${partId}: ${componentNameOf(partId)},`)
  .join('\n')

const manifest = `// 자동 생성 파일 — npm run build:parts가 만든다. 직접 수정 금지.
import type { ComponentType, SVGProps } from 'react'

${imports}

export type PartComponent = ComponentType<SVGProps<SVGSVGElement>>

/** 렌더 z순서 — 아래에서 위로 합성된다 (결정 17). */
export const PART_SLOT_Z_ORDER = ['appendage', 'body', 'pattern', 'eyes', 'mouth'] as const

export const PART_COMPONENTS: Readonly<Record<string, PartComponent>> = {
${entries}
}
`

writeFileSync(join(OUT_DIR, 'partsManifest.ts'), manifest)
console.log(`manifest written: ${partFiles.length} parts → src/assets/parts/partsManifest.ts`)
