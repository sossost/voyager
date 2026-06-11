import { useCallback, useEffect, useState } from 'react'

import { App } from '@/App'
import type { Seed } from '@/engine'
import { GEN_VERSION, originStar } from '@/engine'
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

function readSeedFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('seed')
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
 * genVersion 검사 → 하이드레이트 → 현재 별계 직행.
 */
export function BootGate() {
  const [bootState, setBootState] = useState<BootState>({ status: 'checking' })

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
      await driver.saveProfile(profile)
      await driver.addVisit({ starId: startStarId, visitedAt: profile.createdAt })

      startGame(driver, tier, profile, { visits: [], explorations: [], collection: [] })
      setBootState({ status: 'ready' })
    },
    [],
  )

  switch (bootState.status) {
    case 'checking':
      return (
        <main className="boot-screen" aria-busy="true">
          <h1 className="boot-title">Stellar Voyage</h1>
          <p className="boot-subtitle">항행 시스템 점검 중…</p>
        </main>
      )
    case 'webgl-blocked':
      return <WebGLBlocked />
    case 'seed-setup':
      return (
        <SeedSetup
          prefillSeed={readSeedFromUrl()}
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
