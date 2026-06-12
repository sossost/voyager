import { expect, test } from '@playwright/test'

// 엔진 인덱스 대신 모듈을 직접 임포트한다 — 인덱스는 alien 카탈로그(JSON)를 끌어와
// Playwright의 Node ESM 로더가 import attribute 없이는 거부한다. 은하 생성 모듈은 JSON 무관.
import type { Seed, StarId } from '../../src/engine/coords'
import { parseSeed } from '../../src/engine/coords'
import { originStar } from '../../src/engine/galaxy/origin'
import { starsInSector } from '../../src/engine/galaxy/sectors'

/**
 * 코어 루프 E2E (스펙 AC):
 * 부트 → 시드 온보딩 → 탐사 → 조우 카드 → 도감 → 항법/항행 → 새로고침 복원.
 * 시드 LIFE1은 시작 항성계 p0에 생명체 행성이 있음이 결정론적으로 보장된다.
 */

const LIFE1_SEED = parseSeed('LIFE1')
if (LIFE1_SEED == null) throw new Error('LIFE1 시드가 유효하지 않습니다')
const START_STAR = originStar(LIFE1_SEED)

/**
 * LIFE1의 시작 별과 다른 실제 별 — 결정론적 워프 목적지.
 * 화면공간 별 피킹은 카메라 프레이밍에 따라 가변(퍼스펙티브는 우주선만 중앙에서 잡힘)이라,
 * 워프 도착 자체는 순수 엔진으로 고른 목적지 + store 액션으로 안정적으로 단언한다.
 */
function findWarpTarget(seed: Seed): StarId {
  for (let sx = -3; sx <= 3; sx++) {
    for (let sz = -3; sz <= 3; sz++) {
      for (const star of starsInSector(seed, { sx, sy: 0, sz })) {
        if (star.id !== START_STAR) return star.id
      }
    }
  }
  throw new Error('워프 목적지 별을 찾지 못했습니다')
}
const WARP_TARGET = findWarpTarget(LIFE1_SEED)

test('코어 루프: 온보딩 → 탐사 → 조우 → 도감 → 항법/항행 → 새로고침 복원', async ({ page }) => {
  await page.goto('/?seed=LIFE1')

  // 1) 시드 온보딩 — ?seed= 딥링크 프리필
  await expect(page.getByLabel('우주 시드')).toHaveValue('LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()

  // 2) 부트 완료 — 첫 화면은 시작 별의 우주선 뷰 (항성계가 우주선 뷰에 통합됨, 결정 41)
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible()
  await page.waitForFunction(() => window.__gameStore != null)

  // 3) 행성 선택은 store로(3D 픽킹 대신 상태 단언 전략), 이후 흐름은 실제 UI로
  await page.evaluate(() => {
    const store = window.__gameStore
    if (store == null) throw new Error('store 미노출')
    const state = store.getState()
    if (state.scene.kind !== 'galaxy' || state.scene.view !== 'ship') {
      throw new Error('우주선 뷰가 아님')
    }
    state.selectPlanet(`${state.currentStarId}:p0`)
  })
  await expect(page.getByRole('button', { name: '탐사' })).toBeVisible()
  // 행성 콜아웃은 공전을 따라 흐르도록 설계됨(백로그 G-a-5) — 안정성 검사만 건너뛴다
  await page.getByRole('button', { name: '탐사' }).click({ force: true })

  // 4) 스캔 → 카드 공개 (에픽 2.8s 빌드업)
  await expect(page.getByText('생체 신호 스캔 중…')).toBeVisible()
  await expect(page.getByRole('button', { name: '확인' })).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText('✨ 최초 발견한 종족!')).toBeVisible()
  await page.getByRole('button', { name: '확인' }).click()

  // 5) 도감 — 1/60 해금
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
  await page.keyboard.press('Escape')
  await expect(page.locator('.codex-progress')).toBeHidden()

  // 6) 은하 항법(퍼스펙티브) → 화면 중앙 = 우주선(현재 별) 피킹 → 패널 → 함교 복귀
  //    퍼스펙티브는 OrbitControls 초점이 우주선이라 현재 별이 항상 화면 중앙에 투영된다.
  await page.getByRole('button', { name: '은하 항법' }).click()
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
  // 현재 별 = "현재 위치" → 함교 복귀로 우주선 뷰 귀환
  await page.getByRole('button', { name: '함교 복귀' }).click()
  await expect(page.getByRole('button', { name: '은하 항법' })).toBeVisible()

  // 7) 워프 → 도착: 결정론 이웃 별로 항행. 플래시 피크의 onWarpComplete가 우주선 뷰로 전이한다.
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

  // 8) 새로고침 복원 — SeedSetup 없이 바로 게임, 수집 기록 유지
  await page.reload()
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible({ timeout: 10_000 })
  await page.waitForFunction(
    () => window.__gameStore?.getState().collectedIndividuals.size === 1,
  )
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
})
