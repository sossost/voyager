import { useMemo } from 'react'
import { DoubleSide, RingGeometry } from 'three'

import { getRingTexture } from '@/scenes/system/ringTexture'

/**
 * 토성형 행성 고리 — 방사형 텍스처(ringTexture)를 적도면에 두른다.
 * 단일 평면 단색 대신 띠·간극·밝기 그라데이션이 드러나도록,
 * 고리 지오메트리의 UV를 "안쪽=0, 바깥쪽=1"의 반경 좌표로 다시 매핑한다.
 *
 * 연속 값(공전·자전)은 부모 그룹이 useFrame으로 돌리므로 이 컴포넌트는 정적이다.
 */

/** 행성 반경 대비 고리 안/바깥 모서리 — 실제 토성 고리 비율(약 1.2~2.3R). */
const RING_INNER = 1.2
const RING_OUTER = 2.3
const RING_THETA_SEGMENTS = 160
/** 적도면을 향한 기울기 — 토성 자전축 경사(약 26.7°)를 흉내 낸다. */
const RING_TILT_X = -Math.PI / 2 + 0.46
const RING_TILT_Z = 0.08

/**
 * 단위 반경(1) 고리 지오메트리 — 반경 방향 UV로 재매핑한 싱글톤.
 * 행성별 크기는 메시 scale로 처리하므로 지오메트리는 한 번만 만든다.
 */
function makeRingGeometry(): RingGeometry {
  const geometry = new RingGeometry(RING_INNER, RING_OUTER, RING_THETA_SEGMENTS, 1)
  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  if (position == null || uv == null) return geometry
  for (let i = 0; i < position.count; i++) {
    const radius = Math.hypot(position.getX(i), position.getY(i))
    const radial = (radius - RING_INNER) / (RING_OUTER - RING_INNER)
    uv.setXY(i, radial, 0.5)
  }
  uv.needsUpdate = true
  return geometry
}

let cachedGeometry: RingGeometry | null = null

function ringGeometry(): RingGeometry {
  if (cachedGeometry == null) cachedGeometry = makeRingGeometry()
  return cachedGeometry
}

interface PlanetRingsProps {
  readonly planetVisualRadius: number
}

export function PlanetRings({ planetVisualRadius }: PlanetRingsProps) {
  const geometry = useMemo(() => ringGeometry(), [])
  const texture = useMemo(() => getRingTexture(), [])

  return (
    <mesh
      geometry={geometry}
      scale={planetVisualRadius}
      rotation={[RING_TILT_X, 0, RING_TILT_Z]}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        side={DoubleSide}
        depthWrite={false}
        opacity={1}
      />
    </mesh>
  )
}
