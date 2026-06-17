// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Seed } from '@/engine'
import { originStar, parseSeed } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import { initializeGameStore, useGameStore } from '@/store'
import { TopBar } from './TopBar'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('RESET001')

/** 설정 포브를 열고 '우주 초기화'를 눌러 확인 모달을 띄운다. */
function openResetDialog(): void {
  fireEvent.click(screen.getByRole('button', { name: '시스템 설정' }))
  fireEvent.click(screen.getByRole('button', { name: '우주 초기화' }))
}

describe('TopBar — 우주 초기화 (설정 통합)', () => {
  let driver: MemoryDriver
  let replaceSpy: ReturnType<typeof vi.fn>

  function init({ guestMode = false }: { guestMode?: boolean } = {}): void {
    driver = new MemoryDriver()
    initializeGameStore({ seed, startStarId: originStar(seed), driver, guestMode })
  }

  beforeEach(() => {
    init()
    // jsdom의 location.replace는 미구현(navigation not implemented) → 스텁으로 호출만 단언한다.
    replaceSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/voyager', replace: replaceSpy },
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('설정 팝오버를 열면 우주 초기화 트리거가 보인다', () => {
    render(<TopBar />)

    fireEvent.click(screen.getByRole('button', { name: '시스템 설정' }))

    expect(screen.getByRole('button', { name: '우주 초기화' })).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('트리거를 누르면 팝오버가 닫히고 중앙 확인 모달이 열린다', () => {
    render(<TopBar />)

    openResetDialog()

    // 팝오버는 닫혀 트리거가 사라지고, 모달이 떠 있다
    expect(screen.queryByRole('button', { name: '우주 초기화' })).toBeNull()
    expect(screen.getByRole('alertdialog', { name: '우주를 초기화할까요?' })).toBeTruthy()
  })

  // 회귀: 모달이 팝오버 안에 있으면 팝오버의 "바깥 클릭 닫기"가 모달째 언마운트시킨다.
  it('모달 내부를 눌러도(포인터다운) 모달이 닫히지 않는다', () => {
    render(<TopBar />)

    openResetDialog()
    const dialog = screen.getByRole('alertdialog')
    fireEvent.pointerDown(dialog)
    fireEvent.pointerDown(document.body)

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  // 회귀: 팝오버가 살아 있으면 초기화 클릭 전에 모달이 언마운트돼 클릭이 무시됐다.
  it('초기화를 확정하면 기록을 지우고 시드 화면으로 새로고침한다', async () => {
    await driver.addVisit({ starId: originStar(seed), visitedAt: 0 })

    render(<TopBar />)
    openResetDialog()
    fireEvent.click(screen.getByRole('button', { name: '초기화' }))

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/voyager'))
    expect(await driver.loadProfile()).toBeNull()
    expect((await driver.loadAll()).visits).toHaveLength(0)
  })

  it('취소하면 모달을 닫고 새로고침하지 않는다', () => {
    render(<TopBar />)

    openResetDialog()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('ESC를 누르면 모달을 닫는다 (접근성)', () => {
    render(<TopBar />)

    openResetDialog()
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('백드롭을 누르면 모달을 닫는다', () => {
    render(<TopBar />)

    openResetDialog()
    // 백드롭(다이얼로그 바깥 컨테이너) 자체를 포인터다운
    fireEvent.pointerDown(document.querySelector('.confirm-backdrop') as Element)

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('초기화에 실패하면 새로고침하지 않고 토스트로 안내한다', async () => {
    vi.spyOn(driver, 'reset').mockRejectedValueOnce(new Error('저장소 오류'))

    render(<TopBar />)
    openResetDialog()
    fireEvent.click(screen.getByRole('button', { name: '초기화' }))

    await waitFor(() => expect(useGameStore.getState().toasts.length).toBeGreaterThan(0))
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('게스트 모드에선 우주 초기화 트리거를 숨긴다 (내 실제 기록 보호)', () => {
    cleanup()
    init({ guestMode: true })

    render(<TopBar />)
    fireEvent.click(screen.getByRole('button', { name: '시스템 설정' }))

    expect(screen.queryByRole('button', { name: '우주 초기화' })).toBeNull()
  })
})
