import { useCallback, useEffect, useState } from 'react'

import { App } from '@/App'
import type { Seed, StarId } from '@/engine'
import { GEN_VERSION, originStar, starById } from '@/engine'
import { persist } from '@/persistence/persist'
import { probeStorage } from '@/persistence/probeStorage'
import { detectInitialQualityTier } from '@/quality/detectInitialTier'
import type { Profile, StorageDriver } from '@/persistence/types'
import { SAVE_VERSION } from '@/persistence/types'
import { initializeGameStore } from '@/store'
import type { SystemLink } from '@/store/systemUrl'
import { parseSystemParams, resolveDeepLinkStar } from '@/store/systemUrl'
import type { HydrationRecords } from '@/store/createGameStore'
import type { QualityTier } from '@/store/types'
import { hasWebGLSupport } from '@/ui/boot/hasWebGLSupport'
import { GenVersionNotice } from '@/ui/boot/GenVersionNotice'
import { SeedSetup } from '@/ui/boot/SeedSetup'
import { SharedUniversePrompt } from '@/ui/boot/SharedUniversePrompt'
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
  | {
      readonly status: 'shared-universe'
      readonly driver: StorageDriver
      readonly tier: QualityTier
      readonly profile: Profile
      readonly records: HydrationRecords
      /** 친구가 공유한 (내 것과 다른) 시드. */
      readonly guestSeed: Seed
      /** 공유 딥링크가 가리키는 별 — 없으면 시작 항성계. */
      readonly guestStarId: StarId | null
    }
  | { readonly status: 'ready' }

/**
 * ⚠️ 정식 배포 전 임시 (출시 시 false 또는 제거) — GEN_VERSION 불일치 시 안내 다이얼로그
 * (GenVersionNotice)를 띄우지 않고, 저장 프로필의 버전을 현재로 덮어쓴 뒤 기록을 유지한 채
 * 그대로 진행한다. 생성 분포를 자주 바꾸는 개발 중 매번 묻는 마찰을 없앤다. 실사용자 데이터를
 * 보호하려면 출시 시 반드시 false로 (그러면 기존처럼 다이얼로그로 선택받는다). (백로그 B)
 */
const PRE_RELEASE_AUTO_MIGRATE = true

/** 읽는 시점에 검증 — 유효하지 않은 ?seed=·?star=는 무시한다 (백로그 L-1). */
function readSystemLink(): SystemLink {
  return parseSystemParams(window.location.search)
}

function startGame(
  driver: StorageDriver,
  tier: QualityTier,
  profile: Profile,
  records: HydrationRecords,
  startStarId: StarId,
): void {
  initializeGameStore({
    seed: profile.seed,
    startStarId,
    driver,
    hydration: records,
    initialQualityTier: tier,
    createdAt: profile.createdAt,
    initialSeenHints: profile.seenHints,
    initialDiscoveredPhenomena: profile.discoveredPhenomena,
    initialDiscoveredUniques: profile.discoveredUniques,
  })
}

/**
 * 공유 우주 둘러보기 (백로그 L-1 게스트 모드) — 다른 시드의 우주를 저장 없이 연다.
 * 하이드레이션은 비우고(다른 우주라 내 기록이 무의미), guestMode로 모든 저장 쓰기를 막아
 * 방문자의 본 우주 기록을 보존한다. 온보딩 힌트는 다시 안 뜨게 내 seenHints만 넘긴다.
 */
function startGuestSession(
  driver: StorageDriver,
  tier: QualityTier,
  guestSeed: Seed,
  guestStarId: StarId | null,
  seenHints: Profile['seenHints'],
): void {
  const startStarId = resolveDeepLinkStar(guestSeed, originStar(guestSeed), {
    seed: guestSeed,
    starId: guestStarId,
  })
  initializeGameStore({
    seed: guestSeed,
    startStarId,
    driver,
    hydration: { visits: [], explorations: [], collection: [] },
    initialQualityTier: tier,
    initialSeenHints: seenHints,
    guestMode: true,
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
        if (!PRE_RELEASE_AUTO_MIGRATE) {
          setBootState({ status: 'gen-mismatch', driver, tier, profile, records })
          return
        }
        // 정식 배포 전 임시 — 묻지 않고 저장 버전을 현재로 덮어쓴 뒤 공통 진입 로직으로 폴스루.
        void persist(
          () => driver.saveProfile({ ...profile, genVersion: GEN_VERSION }),
          () => undefined,
        )
      }

      const link = readSystemLink()

      // 내 것과 다른 시드의 공유 딥링크 — 브라우저당 우주는 하나라 충돌한다. 무음 무시 대신
      // 게스트 둘러보기를 제안한다 (백로그 L-1). 같은 시드(또는 시드 없음)면 평소대로 진입.
      if (link.seed != null && link.seed !== profile.seed) {
        setBootState({
          status: 'shared-universe',
          driver,
          tier,
          profile,
          records,
          guestSeed: link.seed,
          guestStarId: link.starId,
        })
        return
      }

      // 딥링크(?star=)가 이 시드에서 유효하면 해당 항성계로 진입, 아니면 저장된 현재 위치.
      const startStarId = resolveDeepLinkStar(profile.seed, profile.currentStarId, link)
      startGame(driver, tier, profile, records, startStarId)
      setBootState({ status: 'ready' })
    }

    void boot()
    return () => {
      isCancelled = true
    }
  }, [])

  const handleStartNewUniverse = useCallback(
    async (driver: StorageDriver, tier: QualityTier, seed: Seed) => {
      const originStarId = originStar(seed)
      const profile: Profile = {
        id: 1,
        seed,
        saveVersion: SAVE_VERSION,
        genVersion: GEN_VERSION,
        currentStarId: originStarId,
        createdAt: Date.now(),
      }

      // 부트 커밋도 단일 저장 경로(persist: 백오프 3회)를 따른다 — 둘 다 업서트라 재시도 안전.
      // 실패 시 온보딩에 머물며 에러를 표시한다 (조용한 고착 방지 — 코드 리뷰 지적).
      let isCommitted = false
      await persist(async () => {
        await driver.saveProfile(profile)
        await driver.addVisit({ starId: originStarId, visitedAt: profile.createdAt })
        isCommitted = true
      }, () => undefined)

      if (!isCommitted) {
        setBootError('우주를 저장하지 못했어요 — 저장 공간을 확인한 뒤 다시 시도해 주세요')
        return
      }

      setBootError(null)
      // 저장 프로필은 Sol 시작을 유지하고(인류의 고향·Sol 불변, G-c-10), 딥링크가 이 시드에서
      // 유효하면 그 항성계를 첫 화면으로 보여준다 — 공유 링크로 도착한 친구가 바로 그 별을 본다.
      const startStarId = resolveDeepLinkStar(seed, profile.currentStarId, readSystemLink())
      startGame(driver, tier, profile, { visits: [], explorations: [], collection: [] }, startStarId)
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
          prefillSeed={readSystemLink().seed}
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
            const { profile, records } = bootState
            const startStarId = resolveDeepLinkStar(
              profile.seed,
              profile.currentStarId,
              readSystemLink(),
            )
            startGame(bootState.driver, bootState.tier, profile, records, startStarId)
            setBootState({ status: 'ready' })
          }}
          onReset={() => {
            void bootState.driver.reset().then(() => {
              setBootState({ status: 'seed-setup', driver: bootState.driver, tier: bootState.tier })
            })
          }}
        />
      )
    case 'shared-universe': {
      const { driver, tier, profile, records, guestSeed, guestStarId } = bootState
      const systemName =
        guestStarId != null ? (starById(guestSeed, guestStarId)?.name ?? null) : null
      return (
        <SharedUniversePrompt
          seed={guestSeed}
          systemName={systemName}
          onEnterGuest={() => {
            startGuestSession(driver, tier, guestSeed, guestStarId, profile.seenHints)
            setBootState({ status: 'ready' })
          }}
          onKeepOwn={() => {
            // 링크 무시 — 내 우주 진입. URL은 동기화 구독이 내 시드로 자가 보정한다.
            startGame(driver, tier, profile, records, profile.currentStarId)
            setBootState({ status: 'ready' })
          }}
        />
      )
    }
    case 'ready':
      return <App />
    default: {
      const _exhaustive: never = bootState
      throw new Error(`처리되지 않은 부트 상태: ${String(_exhaustive)}`)
    }
  }
}
