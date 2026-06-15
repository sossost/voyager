import type { StarKind } from '@/engine'
import { BlackHole } from '@/scenes/system/BlackHole'
import { surfaceModulationOf } from '@/scenes/system/exotic'
import { Pulsar } from '@/scenes/system/Pulsar'
import { StarSurface } from '@/scenes/system/StarSurface'

/**
 * 이색 천체 본체 디스패처 (결정 14) — CurrentSystem의 bodies[0]이 주성이고 kind가
 * main_sequence가 아닐 때 StarSurface 대신 렌더된다. 부모 group ref·uOpacity 크로스페이드
 * 계약은 각 컴포넌트가 StarSurface와 동일하게 준수한다(도착 팝인 방지).
 */

interface ExoticBodyProps {
  readonly kind: StarKind
  readonly radius: number
  /** 본체 색 (EXOTIC_RENDER) — 거성/왜성/펄서 본체에 쓰인다. 블랙홀은 무시. */
  readonly color: string
}

export function ExoticBody({ kind, radius, color }: ExoticBodyProps) {
  if (kind === 'black_hole') return <BlackHole radius={radius} />
  if (kind === 'pulsar') return <Pulsar radius={radius} color={color} />

  // red_giant / white_dwarf — StarSurface 셰이더 변조(발광 강도·코로나 크기)로 재사용.
  const modulation = surfaceModulationOf(kind)
  return (
    <StarSurface
      radius={radius}
      color={color}
      emissiveBoost={modulation.emissiveBoost}
      coronaScale={modulation.coronaScale}
    />
  )
}
