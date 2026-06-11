import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Vector3 } from 'three'

import type { SectorCoords, Star } from '@/engine'
import {
  GALAXY_HALF_THICKNESS_SECTORS,
  SECTOR_SIZE,
  starsInSector,
} from '@/engine'
import { QUALITY_PRESETS } from '@/quality/presets'
import { LruCache } from '@/scenes/shared/lruCache'
import { useGameStore } from '@/store'

export interface LoadedSector {
  readonly key: string
  readonly coords: SectorCoords
  readonly stars: readonly Star[]
  /** 페이드인 기준 시각 (clock.elapsedTime, 초). */
  readonly bornAt: number
}

/** 섹터 매니저 갱신 주기 — 매 프레임 diff는 낭비다 (결정 12). */
const UPDATE_INTERVAL_S = 0.2

function sectorKeyOf(coords: SectorCoords): string {
  return `${coords.sx}:${coords.sy}:${coords.sz}`
}

function chebyshevDistance(a: SectorCoords, b: SectorCoords): number {
  return Math.max(Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy), Math.abs(a.sz - b.sz))
}

function lruCapacityFor(loadRadius: number): number {
  const keepDiameter = 2 * (loadRadius + 1) + 1
  // 용량 ≥ 최대 가시 작업셋 × 2 — 'LRU < 가시 작업셋' 자기모순 교정 (결정 12)
  return keepDiameter * keepDiameter * keepDiameter * 2
}

/**
 * 카메라 주변 섹터 가상화 — 로드 반경 R / 언로드 반경 R+1 히스테리시스로
 * 경계 진동 스래싱을 막고, 별이 있는 섹터만 노출한다.
 */
export function useVisibleSectors(): readonly LoadedSector[] {
  const seed = useGameStore((state) => state.seed)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const preset = QUALITY_PRESETS[qualityTier]

  const [visibleSectors, setVisibleSectors] = useState<readonly LoadedSector[]>([])
  const loadedRef = useRef(new Map<string, LoadedSector>())
  const cacheRef = useRef<LruCache<string, readonly Star[]> | null>(null)
  const lastUpdateRef = useRef(Number.NEGATIVE_INFINITY)

  if (cacheRef.current == null) {
    cacheRef.current = new LruCache(lruCapacityFor(preset.sectorLoadRadius))
  }

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    if (elapsed - lastUpdateRef.current < UPDATE_INTERVAL_S) return
    lastUpdateRef.current = elapsed

    const controls = state.controls as { target?: Vector3 } | null
    const focus = controls?.target ?? state.camera.position
    const center: SectorCoords = {
      sx: Math.floor(focus.x / SECTOR_SIZE),
      sy: Math.floor(focus.y / SECTOR_SIZE),
      sz: Math.floor(focus.z / SECTOR_SIZE),
    }

    const loadRadius = preset.sectorLoadRadius
    const keepRadius = loadRadius + 1
    const loaded = loadedRef.current
    const cache = cacheRef.current
    if (cache == null) return

    let hasChanged = false

    for (const [key, sector] of loaded) {
      if (chebyshevDistance(sector.coords, center) > keepRadius) {
        loaded.delete(key)
        hasChanged = true
      }
    }

    const minSy = Math.max(center.sy - loadRadius, -GALAXY_HALF_THICKNESS_SECTORS)
    const maxSy = Math.min(center.sy + loadRadius, GALAXY_HALF_THICKNESS_SECTORS)

    for (let sx = center.sx - loadRadius; sx <= center.sx + loadRadius; sx++) {
      for (let sy = minSy; sy <= maxSy; sy++) {
        for (let sz = center.sz - loadRadius; sz <= center.sz + loadRadius; sz++) {
          const coords: SectorCoords = { sx, sy, sz }
          const key = sectorKeyOf(coords)
          if (loaded.has(key)) continue

          const stars = cache.getOrCompute(key, () => starsInSector(seed, coords))
          if (stars.length === 0) continue

          loaded.set(key, { key, coords, stars, bornAt: elapsed })
          hasChanged = true
        }
      }
    }

    if (hasChanged) {
      setVisibleSectors([...loaded.values()])
    }
  })

  return visibleSectors
}
