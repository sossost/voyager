import { expect, test } from '@playwright/test'

/**
 * IndexedDB 차단 환경 폴백 E2E (스펙 AC):
 * 메모리 모드로 동작하며 경고 배너가 상시 표시되고, 도감·일지를 포함한
 * 전체 플레이가 가능해야 한다 (폴백 동등성 — 결정 19).
 */

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

  // 탐사·조우도 메모리 모드에서 동일하게 동작
  await page.evaluate(() => {
    const store = window.__gameStore
    if (store == null) throw new Error('store 미노출')
    const state = store.getState()
    state.selectPlanet(`${state.scene.starId}:p0`)
  })
  await page.getByRole('button', { name: '탐사' }).click()
  await expect(page.getByRole('button', { name: '확인' })).toBeVisible({ timeout: 8_000 })
  await page.getByRole('button', { name: '확인' }).click()

  // 도감 — 메모리 모드에서도 동등하게 동작 (liveQuery 미채택의 이유)
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
  await page.keyboard.press('Escape')

  // 일지 — 어댑터 페이징도 메모리 드라이버에서 동일 계약
  await page.getByRole('button', { name: '일지' }).click()
  await expect(page.locator('.visit-entry')).toHaveCount(1)
})
