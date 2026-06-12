import { expect, test } from '@playwright/test'

import type { PlanetId, Seed, StarId } from '../../src/engine/coords'
import { parseSeed } from '../../src/engine/coords'
import { starsInSector } from '../../src/engine/galaxy/sectors'
import { planetsOf } from '../../src/engine/system/planets'
import { SOL_STAR_ID } from '../../src/engine/system/sol'

/**
 * IndexedDB 차단 환경 폴백 E2E (스펙 AC):
 * 메모리 모드로 동작하며 경고 배너가 상시 표시되고, 도감·일지를 포함한
 * 전체 플레이가 가능해야 한다 (폴백 동등성 — 결정 19).
 */

const LIFE1_SEED = parseSeed('LIFE1') as Seed

function findNearbyLifeTarget(seed: Seed): { starId: StarId; planetId: PlanetId } {
  for (let sx = -3; sx <= 3; sx++) {
    for (let sz = -3; sz <= 3; sz++) {
      for (const star of starsInSector(seed, { sx, sy: 0, sz })) {
        if (star.id === SOL_STAR_ID) continue
        const life = planetsOf(seed, star.id).find((p) => p.hasLife && p.isHomeWorld !== true)
        if (life != null) return { starId: star.id, planetId: life.id }
      }
    }
  }
  throw new Error('인근 생명체 행성을 찾지 못했습니다')
}

const { starId: LIFE_STAR, planetId: LIFE_PLANET } = findNearbyLifeTarget(LIFE1_SEED)

test('IndexedDB 차단: 메모리 폴백 + 경고 배너 + 전체 플레이 가능', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('IndexedDB blocked (사생활 모드 시뮬레이션)')
      },
    })
  })

  await page.goto('/?seed=LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()

  // 경고 배너 상시 표시
  await expect(page.getByText(/기록이 저장되지 않아요/)).toBeVisible()
  await page.waitForFunction(() => window.__gameStore?.getState().storageMode === 'memory')

  // 생명체 별로 워프 (지구는 isHomeWorld → 외계인 없음)
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

  // 탐사·조우도 메모리 모드에서 동일하게 동작
  await page.evaluate((planetId) => {
    const store = window.__gameStore
    if (store == null) throw new Error('store 미노출')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.getState().selectPlanet(planetId as any)
  }, LIFE_PLANET)
  // 행성 콜아웃은 공전을 따라 흐르도록 설계됨(백로그 G-a-5) — 안정성 검사만 건너뛴다
  await expect(page.getByRole('button', { name: '탐사' })).toBeVisible()
  await page.getByRole('button', { name: '탐사' }).click({ force: true })
  await expect(page.getByRole('button', { name: '확인' })).toBeVisible({ timeout: 8_000 })
  await page.getByRole('button', { name: '확인' }).click()

  // 도감 — 메모리 모드에서도 동등하게 동작 (liveQuery 미채택의 이유)
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
  await page.keyboard.press('Escape')

  // 일지 — 어댑터 페이징도 메모리 드라이버에서 동일 계약 (Sol + LIFE_STAR 2방문)
  await page.getByRole('button', { name: '일지' }).click()
  await expect(page.locator('.visit-entry').first()).toBeVisible()
})
