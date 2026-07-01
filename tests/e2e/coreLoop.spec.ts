import { expect, test } from '@playwright/test'

// 엔진 인덱스 대신 모듈을 직접 임포트한다 — 인덱스는 alien 카탈로그(JSON)를 끌어와
// Playwright의 Node ESM 로더가 import attribute 없이는 거부한다. 은하 생성 모듈은 JSON 무관.
import type { PlanetId, Seed, StarId } from '../../src/engine/coords'
import { parseSeed } from '../../src/engine/coords'
import { originStar } from '../../src/engine/galaxy/origin'
import { starsInSector } from '../../src/engine/galaxy/sectors'
import { planetsOf } from '../../src/engine/system/planets'
import { SOL_SECTOR, SOL_STAR_ID } from '../../src/engine/system/sol'

/**
 * 코어 루프 E2E (스펙 AC):
 * 부트 → 시드 온보딩 → Sol 출발 → 인근 생명체 별로 워프 → 탐사 → 조우 카드 →
 * 도감 → 항법/항행 → 새로고침 복원.
 *
 * G-c-10 이후 모든 시드는 Sol에서 출발한다. 지구(isHomeWorld)는 외계인이 없으므로
 * 인근 비-Sol 별에서 생명체 행성을 찾아 워프한다.
 */

const LIFE1_SEED = parseSeed('LIFE1')
if (LIFE1_SEED == null) throw new Error('LIFE1 시드가 유효하지 않습니다')

/** Sol 시작이 모든 시드에서 보장되는지 확인 */
const START_STAR = originStar(LIFE1_SEED)
if (START_STAR !== SOL_STAR_ID) {
  throw new Error(`시작 별이 Sol이 아닙니다: ${START_STAR}`)
}

/**
 * LIFE1 시드에서 Sol 인근의 첫 번째 생명체 행성(isHomeWorld 제외).
 * warpTo → selectPlanet → explore 순서로 사용한다.
 */
function findNearbyLifeTarget(seed: Seed): { starId: StarId; planetId: PlanetId } {
  for (let dsx = -3; dsx <= 3; dsx++) {
    for (let dsz = -3; dsz <= 3; dsz++) {
      const sx = SOL_SECTOR.sx + dsx
      const sz = SOL_SECTOR.sz + dsz
      for (const star of starsInSector(seed, { sx, sy: 0, sz })) {
        if (star.id === SOL_STAR_ID) continue
        const planets = planetsOf(seed, star.id)
        const lifePlanet = planets.find((p) => p.hasLife && p.isHomeWorld !== true)
        if (lifePlanet != null) {
          return { starId: star.id, planetId: lifePlanet.id }
        }
      }
    }
  }
  throw new Error('인근 생명체 행성을 찾지 못했습니다')
}

const { starId: LIFE_STAR, planetId: LIFE_PLANET } = findNearbyLifeTarget(LIFE1_SEED)

/**
 * LIFE_STAR와 다른 실제 별 — 결정론적 워프 목적지 (항법 단계용).
 */
function findWarpTarget(seed: Seed): StarId {
  for (let dsx = -3; dsx <= 3; dsx++) {
    for (let dsz = -3; dsz <= 3; dsz++) {
      const sx = SOL_SECTOR.sx + dsx
      const sz = SOL_SECTOR.sz + dsz
      for (const star of starsInSector(seed, { sx, sy: 0, sz })) {
        if (star.id !== START_STAR && star.id !== LIFE_STAR) return star.id
      }
    }
  }
  throw new Error('워프 목적지 별을 찾지 못했습니다')
}
const WARP_TARGET = findWarpTarget(LIFE1_SEED)

test('코어 루프: 온보딩 → Sol 출발 → 워프 → 탐사 → 조우 → 도감 → 항법/항행 → 새로고침 복원', async ({
  page,
}) => {
  await page.goto('/?seed=LIFE1')

  // 1) 시드 온보딩 — ?seed= 딥링크 프리필
  await expect(page.getByLabel('우주 시드')).toHaveValue('LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()

  // 2) 부트 완료 — Sol(태양계) 우주선 뷰
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible()
  await page.waitForFunction(() => window.__gameStore != null)

  // 3) 생명체 별로 워프 (지구는 isHomeWorld라 외계인 없음 — 인근 별로 이동)
  await page.evaluate((target) => {
    window.__gameStore?.getState().warpTo(target)
  }, LIFE_STAR)
  await page.waitForFunction(
    (target) => {
      const state = window.__gameStore?.getState()
      return (
        state?.currentStarId === target &&
        state.scene.kind === 'galaxy' &&
        state.scene.view === 'ship'
      )
    },
    LIFE_STAR,
    { timeout: 10_000 },
  )

  // 4) 행성 선택 (store 직접 — 3D 픽킹 대신 상태 단언 전략)
  await page.evaluate((planetId) => {
    const store = window.__gameStore
    if (store == null) throw new Error('store 미노출')
    const state = store.getState()
    if (state.scene.kind !== 'galaxy' || state.scene.view !== 'ship') {
      throw new Error('우주선 뷰가 아님')
    }
    state.selectPlanet(planetId as Parameters<typeof state.selectPlanet>[0])
  }, LIFE_PLANET)
  await expect(page.getByRole('button', { name: '탐사' })).toBeVisible()
  await page.getByRole('button', { name: '탐사' }).click({ force: true })

  // 5) 스캔 → 카드 공개 (에픽 2.8s 빌드업)
  await expect(page.getByText('생체 신호 스캔 중…')).toBeVisible()
  await expect(page.getByRole('button', { name: '확인' })).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText('✨ 최초 발견한 종족!')).toBeVisible()
  await page.getByRole('button', { name: '확인' }).click()

  // 6) 도감 — 1/60 해금
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
  await page.keyboard.press('Escape')
  await expect(page.locator('.codex-progress')).toBeHidden()

  // 7) 항법(퍼스펙티브) → 화면 중앙 = 우주선(현재 별) 피킹 → 패널 → 함교 복귀
  //    퍼스펙티브는 OrbitControls 초점이 우주선이라 현재 별이 항상 화면 중앙에 투영된다.
  //    뷰 전환은 콘솔 데크의 모드 세그먼트 (결정 42-b).
  await page.getByRole('button', { name: '▦ 항법' }).click()
  await page.waitForTimeout(300) // 카메라 안착
  // 첫 canvas = 메인 씬 (dev 모드엔 r3f-perf 오버레이 canvas가 하나 더 있다)
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (box == null) throw new Error('canvas 바운딩 박스를 찾지 못했습니다')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const panel = page.locator('.star-info-panel')
  for (const [dx, dy] of [[0, 0], [-8, 0], [8, 0], [0, -8], [0, 8]] as const) {
    await page.mouse.click(cx + dx, cy + dy)
    if (await panel.isVisible()) break
  }
  await expect(panel).toBeVisible()
  // 현재 별 = "현재 위치" → 함교 복귀로 우주선 뷰 귀환 (세그먼트 함교 셀 점등으로 단언)
  await page.getByRole('button', { name: '함교 복귀' }).click()
  await expect(page.getByRole('button', { name: '◉ 함교' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // 8) 워프 → 도착: 결정론 이웃 별로 항행. 플래시 피크의 onWarpComplete가 우주선 뷰로 전이한다.
  await page.evaluate((target) => {
    window.__gameStore?.getState().warpTo(target)
  }, WARP_TARGET)
  await page.waitForFunction(
    (target) => {
      const state = window.__gameStore?.getState()
      return (
        state?.currentStarId === target &&
        state.scene.kind === 'galaxy' &&
        state.scene.view === 'ship'
      )
    },
    WARP_TARGET,
    { timeout: 10_000 },
  )

  // 9) 새로고침 복원 — SeedSetup 없이 바로 게임, 수집 기록 유지
  await page.reload()
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible({ timeout: 10_000 })
  await page.waitForFunction(() => window.__gameStore?.getState().collectedIndividuals.size === 1)
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
})

/**
 * 항성계 공유 딥링크 (백로그 L-1): `?seed=&star=`로 진입하면 해당 항성계에서 시작하고,
 * 정박 동안 주소창이 그 항성계를 가리킨다 (replaceState 동기화).
 * 공유 링크를 받은 친구(신규 플레이어)는 온보딩 후 곧장 그 별을 본다.
 */
test('딥링크: ?seed=&star= 진입 시 해당 항성계 복원 + 주소창 동기화', async ({ page }) => {
  await page.goto(`/?seed=LIFE1&star=${WARP_TARGET}`)

  // 시드 온보딩 — 프리필 시드로 출발 (신규 플레이어)
  await expect(page.getByLabel('우주 시드')).toHaveValue('LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()

  await expect(page.getByRole('button', { name: '도감' })).toBeVisible()
  await page.waitForFunction(() => window.__gameStore != null)

  // 딥링크의 항성계에서 정박 시작
  await page.waitForFunction(
    (target) => window.__gameStore?.getState().currentStarId === target,
    WARP_TARGET,
    { timeout: 10_000 },
  )

  // 주소창이 정박 항성계를 반영한다 (history.replaceState)
  await expect.poll(() => new URL(page.url()).searchParams.get('star')).toBe(WARP_TARGET)
  expect(new URL(page.url()).searchParams.get('seed')).toBe('LIFE1')
})

/**
 * 게스트 둘러보기 (백로그 L-1): 내 우주(LIFE1)를 저장한 상태에서 다른 시드의 공유 딥링크를
 * 열면 → 충돌 프롬프트 → '둘러보기'는 저장 없는 게스트 세션, '내 우주로 돌아가기'는 복귀.
 */
const GUEST_SEED = (() => {
  const s = parseSeed('VOYAGER')
  if (s == null) throw new Error('VOYAGER 시드가 유효하지 않습니다')
  return s
})()

/** VOYAGER에서 Sol이 아닌 실제 별 하나 — 게스트 딥링크 별 복원 검증용. */
function findGuestStar(seed: Seed): StarId {
  for (let dsx = -3; dsx <= 3; dsx++) {
    for (let dsz = -3; dsz <= 3; dsz++) {
      for (const star of starsInSector(seed, {
        sx: SOL_SECTOR.sx + dsx,
        sy: 0,
        sz: SOL_SECTOR.sz + dsz,
      })) {
        if (star.id !== SOL_STAR_ID) return star.id
      }
    }
  }
  throw new Error('VOYAGER에서 별을 찾지 못했습니다')
}
const GUEST_STAR = findGuestStar(GUEST_SEED)

test('게스트 둘러보기: 다른 시드 딥링크 → 충돌 프롬프트 → 저장 없이 둘러보기 → 복귀', async ({
  page,
}) => {
  // 1) 내 우주(LIFE1) 생성 — 프로필 저장
  await page.goto('/?seed=LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible()
  await page.waitForFunction(() => window.__gameStore != null)

  // 2) 다른 시드의 공유 딥링크 → 충돌 프롬프트
  await page.goto(`/?seed=VOYAGER&star=${GUEST_STAR}`)
  await expect(page.getByRole('button', { name: '공유 우주 둘러보기' })).toBeVisible()

  // 3) 둘러보기 → 게스트 세션 (시드=VOYAGER, 딥링크 별, isGuestMode)
  await page.getByRole('button', { name: '공유 우주 둘러보기' }).click()
  await page.waitForFunction(() => window.__gameStore?.getState().isGuestMode === true)
  const guest = await page.evaluate(() => {
    const s = window.__gameStore!.getState()
    return { seed: s.seed, currentStarId: s.currentStarId, isGuestMode: s.isGuestMode }
  })
  expect(guest.seed).toBe('VOYAGER')
  expect(guest.currentStarId).toBe(GUEST_STAR)
  expect(guest.isGuestMode).toBe(true)

  // 4) '내 우주로 돌아가기' → 내 우주(LIFE1) 복귀, 게스트 해제
  await page.getByRole('button', { name: '내 우주로 돌아가기' }).click()
  await page.waitForFunction(() => window.__gameStore?.getState().isGuestMode === false, undefined, {
    timeout: 10_000,
  })
  const own = await page.evaluate(() => {
    const s = window.__gameStore!.getState()
    return { seed: s.seed, isGuestMode: s.isGuestMode }
  })
  expect(own.seed).toBe('LIFE1')
  expect(own.isGuestMode).toBe(false)
})

/**
 * 일지 워프 (백로그 L-2): 방문 기록에서 현재 위치가 아닌 항성계로 바로 워프한다.
 * 기존 워프 파이프라인 재사용 — 일지를 닫고 그 별로 항행한다.
 */
test('일지 워프: 방문 기록의 항행 버튼 → 해당 항성계로 워프 + 일지 닫힘', async ({ page }) => {
  await page.goto('/?seed=LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible()
  await page.waitForFunction(() => window.__gameStore != null)

  // 방문 기록을 두 별로 쌓는다 — 현재 위치(WARP_TARGET) + 과거 방문(LIFE_STAR).
  // 다음 워프는 정박(galaxy/ship 전이) 후에만 발동된다 — warpTo는 warping 중 무시된다.
  const warpAndAnchor = async (target: StarId) => {
    await page.evaluate((t) => window.__gameStore?.getState().warpTo(t), target)
    await page.waitForFunction(
      (t) => {
        const state = window.__gameStore?.getState()
        return (
          state?.currentStarId === t && state.scene.kind === 'galaxy' && state.scene.view === 'ship'
        )
      },
      target,
      { timeout: 10_000 },
    )
  }
  await warpAndAnchor(LIFE_STAR)
  await warpAndAnchor(WARP_TARGET)

  // 일지 열기 → 과거 방문 별에 항행 버튼 (현재 위치는 배지)
  await page.getByRole('button', { name: '일지' }).click()
  const warpButton = page.getByRole('button', { name: /항행/ }).first()
  await expect(warpButton).toBeVisible()

  // 항행 → 일지 닫힘 + 현재 항성계가 과거 방문 별로 변경
  await warpButton.click()
  await expect(page.getByRole('heading', { name: '탐사 일지' })).toBeHidden()
  await page.waitForFunction(
    (previous) => window.__gameStore?.getState().currentStarId !== previous,
    WARP_TARGET,
    { timeout: 10_000 },
  )
})
