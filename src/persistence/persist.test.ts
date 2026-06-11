import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { persist } from '@/persistence/persist'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('persist', () => {
  it('성공하면 한 번만 실행한다', async () => {
    const operation = vi.fn(() => Promise.resolve())
    const onFailure = vi.fn()

    await persist(operation, onFailure)

    expect(operation).toHaveBeenCalledTimes(1)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('실패하면 200/600/1800ms 백오프로 3회 재시도한다', async () => {
    let failuresLeft = 3
    const operation = vi.fn(() => {
      if (failuresLeft > 0) {
        failuresLeft -= 1
        return Promise.reject(new Error('일시 오류'))
      }
      return Promise.resolve()
    })
    const onFailure = vi.fn()

    const running = persist(operation, onFailure)

    await vi.advanceTimersByTimeAsync(200)
    expect(operation).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(600)
    expect(operation).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(1_800)
    expect(operation).toHaveBeenCalledTimes(4)

    await running
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('재시도를 전부 소진하면 onFailure를 호출하고 끝낸다 (진행 비차단)', async () => {
    const error = new Error('영구 오류')
    const operation = vi.fn(() => Promise.reject(error))
    const onFailure = vi.fn()

    const running = persist(operation, onFailure)
    await vi.advanceTimersByTimeAsync(200 + 600 + 1_800)
    await running

    expect(operation).toHaveBeenCalledTimes(4) // 최초 1회 + 재시도 3회
    expect(onFailure).toHaveBeenCalledWith(error)
  })
})
