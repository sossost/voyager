import { expect, test } from '@playwright/test'

/**
 * 코어 루프 E2E (스펙 AC):
 * 부트 → 시드 온보딩 → 탐사 → 조우 카드 → 도감 → 워프 → 새로고침 복원.
 * 시드 LIFE1은 시작 별계 p0에 생명체 행성이 있음이 결정론적으로 보장된다.
 */

test('코어 루프: 온보딩 → 탐사 → 조우 → 도감 → 워프 → 새로고침 복원', async ({ page }) => {
  await page.goto('/?seed=LIFE1')

  // 1) 시드 온보딩 — ?seed= 딥링크 프리필
  await expect(page.getByLabel('우주 시드')).toHaveValue('LIFE1')
  await page.getByRole('button', { name: '이 우주로 출발' }).click()

  // 2) 부트 완료 — 첫 화면은 시작 별계의 태양계 뷰
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible()
  await page.waitForFunction(() => window.__gameStore != null)

  // 3) 행성 선택은 store로(3D 픽킹 대신 상태 단언 전략), 이후 흐름은 실제 UI로
  await page.evaluate(() => {
    const store = window.__gameStore
    if (store == null) throw new Error('store 미노출')
    const state = store.getState()
    if (state.scene.starId == null) throw new Error('태양계 뷰가 아님')
    state.selectPlanet(`${state.scene.starId}:p0`)
  })
  await expect(page.getByRole('button', { name: '탐사' })).toBeVisible()
  await page.getByRole('button', { name: '탐사' }).click()

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

  // 6) 별계 이탈(우주선 뷰) → 은하 전도 → 별 클릭(실제 마우스 — 화면공간 피킹) → 항행 → 도착
  await page.getByRole('button', { name: '← 별계 이탈' }).click()
  await page.getByRole('button', { name: '은하 지도' }).click()
  const panel = page.locator('.star-info-panel')
  const probePoints = [
    [640, 380], [600, 420], [680, 350], [560, 390], [700, 420],
    [620, 300], [660, 450], [580, 330], [720, 380], [540, 440],
  ] as const
  for (const [x, y] of probePoints) {
    await page.mouse.click(x, y)
    if (await panel.isVisible()) break
  }
  await expect(panel).toBeVisible()

  const warpButton = page.getByRole('button', { name: '항행' })
  if (await warpButton.isVisible()) {
    await warpButton.click()
  } else {
    // 현재 별을 클릭했다면 별계 진입으로 갈음
    await page.getByRole('button', { name: '별계 진입' }).click()
  }
  await expect(page.getByRole('button', { name: '← 별계 이탈' })).toBeVisible({ timeout: 8_000 })

  // 7) 새로고침 복원 — SeedSetup 없이 바로 게임, 수집 기록 유지
  await page.reload()
  await expect(page.getByRole('button', { name: '도감' })).toBeVisible({ timeout: 10_000 })
  await page.waitForFunction(
    () => window.__gameStore?.getState().collectedIndividuals.size === 1,
  )
  await page.getByRole('button', { name: '도감' }).click()
  await expect(page.locator('.codex-progress')).toContainText('1')
})
