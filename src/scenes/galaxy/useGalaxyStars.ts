import { useMemo } from 'react'

import type { Seed, Star } from '@/engine'
import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  starsInSector,
} from '@/engine'
import { useGameStore } from '@/store'

/**
 * 은하 전체 별의 전수 생성 — 은하가 유한(반경 48섹터, 약 7천 별)이라
 * 섹터 가상화 없이 한 번에 만든다 (실측 ~50ms, 결정 22).
 *
 * 씬 전환(은하↔별계)마다 GalaxyScene이 리마운트되므로
 * 모듈 레벨에서 시드당 1회만 생성하도록 캐시한다. 생성은 결정론적이라 안전하다.
 */
let cachedSeed: Seed | null = null
let cachedStars: readonly Star[] = []

export function generateGalaxyStars(seed: Seed): readonly Star[] {
  if (cachedSeed === seed) return cachedStars

  const stars: Star[] = []
  for (let sx = -GALAXY_RADIUS_SECTORS; sx <= GALAXY_RADIUS_SECTORS; sx++) {
    for (let sz = -GALAXY_RADIUS_SECTORS; sz <= GALAXY_RADIUS_SECTORS; sz++) {
      for (let sy = -GALAXY_HALF_THICKNESS_SECTORS; sy <= GALAXY_HALF_THICKNESS_SECTORS; sy++) {
        for (const star of starsInSector(seed, { sx, sy, sz })) {
          stars.push(star)
        }
      }
    }
  }

  cachedSeed = seed
  cachedStars = stars
  return stars
}

/** 현재 우주의 모든 별 — 은하 지도에 보이는 별 = 클릭 가능한 별 = 이 배열. */
export function useGalaxyStars(): readonly Star[] {
  const seed = useGameStore((state) => state.seed)
  return useMemo(() => generateGalaxyStars(seed), [seed])
}
