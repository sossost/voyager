import { useCallback, useEffect, useState } from 'react'

import { App } from '@/App'
import type { Seed } from '@/engine'
import { GEN_VERSION, originStar, parseSeed } from '@/engine'
import { persist } from '@/persistence/persist'
import { probeStorage } from '@/persistence/probeStorage'
import { detectInitialQualityTier } from '@/quality/detectInitialTier'
import type { Profile, StorageDriver } from '@/persistence/types'
import { SAVE_VERSION } from '@/persistence/types'
import { initializeGameStore } from '@/store'
import type { HydrationRecords } from '@/store/createGameStore'
import type { QualityTier } from '@/store/types'
import { hasWebGLSupport } from '@/ui/boot/hasWebGLSupport'
import { GenVersionNotice } from '@/ui/boot/GenVersionNotice'
import { SeedSetup } from '@/ui/boot/SeedSetup'
import { WebGLBlocked } from '@/ui/boot/WebGLBlocked'

type BootState =
  | { readonly status: 'checking' }
  | { readonly status: 'webgl-blocked' }
  | { readonly status: 'seed-setup'; readonly driver: StorageDriver; readonly tier: QualityTier }
  | {
      readonly status: 'gen-mismatch'
      readonly driver: StorageDriver
      readonly tier: QualityTier
      readonly profile: Profile
      readonly records: HydrationRecords
    }
  | { readonly status: 'ready' }

/** 읽는 시점에 검증 — 유효하지 않은 ?seed=는 프리필 자체를 하지 않는다. */
function readSeedFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('seed')
  if (raw == null) return null
  return parseSeed(raw)
}

function startGame(
  driver: StorageDriver,
  tier: QualityTier,
  profile: Profile,
  records: HydrationRecords,
): void {
  initializeGameStore({
    seed: profile.seed,
    startStarId: profile.currentStarId,
    driver,
    hydration: records,
    initialQualityTier: tier,
    createdAt: profile.createdAt,
  })
}

/**
 * 부트 시퀀스 (01-spec.md Happy Path 1):
 * WebGL 프로브 → 저장소 프로브 → 프로필 복원(없으면 SeedSetup) →
 * genVersion 검사 → 하이드레이트 → 현재 항성계 직행.
 */
export function BootGate() {
  const [bootState, setBootState] = useState<BootState>({ status: 'checking' })
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const boot = async () => {
      if (!hasWebGLSupport()) {
        setBootState({ status: 'webgl-blocked' })
        return
      }

      const [driver, tier] = await Promise.all([probeStorage(), detectInitialQualityTier()])
      const profile = await driver.loadProfile()
      if (isCancelled) return

      if (profile == null) {
        setBootState({ status: 'seed-setup', driver, tier })
        return
      }

      const records = await driver.loadAll()
      if (isCancelled) return

      if (profile.genVersion !== GEN_VERSION) {
        setBootState({ status: 'gen-mismatch', driver, tier, profile, records })
        return
      }

      startGame(driver, tier, profile, records)
      setBootState({ status: 'ready' })
    }

    void boot()
    return () => {
      isCancelled = true
    }
  }, [])

  const handleStartNewUniverse = useCallback(
    async (driver: StorageDriver, tier: QualityTier, seed: Seed) => {
      const startStarId = originStar(seed)
      const profile: Profile = {
        id: 1,
        seed,
        saveVersion: SAVE_VERSION,
        genVersion: GEN_VERSION,
        currentStarId: startStarId,
        createdAt: Date.now(),
      }

      // 부트 커밋도 단일 저장 경로(persist: 백오프 3회)를 따른다 — 둘 다 업서트라 재시도 안전.
      // 실패 시 온보딩에 머물며 에러를 표시한다 (조용한 고착 방지 — 코드 리뷰 지적).
      let isCommitted = false
      await persist(async () => {
        await driver.saveProfile(profile)
        await driver.addVisit({ starId: startStarId, visitedAt: profile.createdAt })
        isCommitted = true
      }, () => undefined)

      if (!isCommitted) {
        setBootError('우주를 저장하지 못했어요 — 저장 공간을 확인한 뒤 다시 시도해 주세요')
        return
      }

      setBootError(null)
      startGame(driver, tier, profile, { visits: [], explorations: [], collection: [] })
      setBootState({ status: 'ready' })
    },
    [],
  )

  switch (bootState.status) {
    case 'checking':
      return (
        <main className="boot-screen" aria-busy="true">
          <h1 className="boot-title">Voyager</h1>
          <p className="boot-subtitle">항행 시스템 점검 중…</p>
        </main>
      )
    case 'webgl-blocked':
      return <WebGLBlocked />
    case 'seed-setup':
      return (
        <SeedSetup
          prefillSeed={readSeedFromUrl()}
          submitError={bootError}
          onStart={(seed) => void handleStartNewUniverse(bootState.driver, bootState.tier, seed)}
        />
      )
    case 'gen-mismatch':
      return (
        <GenVersionNotice
          savedVersion={bootState.profile.genVersion}
          currentVersion={GEN_VERSION}
          onContinue={() => {
            startGame(bootState.driver, bootState.tier, bootState.profile, bootState.records)
            setBootState({ status: 'ready' })
          }}
          onReset={() => {
            void bootState.driver.reset().then(() => {
              setBootState({ status: 'seed-setup', driver: bootState.driver, tier: bootState.tier })
            })
          }}
        />
      )
    case 'ready':
      return <App />
    default: {
      const _exhaustive: never = bootState
      throw new Error(`처리되지 않은 부트 상태: ${String(_exhaustive)}`)
    }
  }
}
