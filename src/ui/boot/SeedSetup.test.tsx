// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateRandomSeed } from './generateRandomSeed'
import { SeedSetup } from './SeedSetup'

afterEach(cleanup)

describe('generateRandomSeed', () => {
  it('항상 유효한 시드 형식(영숫자 12자)을 만든다', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRandomSeed()).toMatch(/^[A-Za-z0-9]{12}$/)
    }
  })
})

describe('SeedSetup', () => {
  it('프리필 시드(?seed= 딥링크)가 입력에 채워진다', () => {
    const { getByLabelText } = render(<SeedSetup prefillSeed="FRIENDSEED" onStart={vi.fn()} />)
    expect((getByLabelText('우주 시드') as HTMLInputElement).value).toBe('FRIENDSEED')
  })

  it('유효하지 않은 시드는 인라인 에러를 보이고 시작하지 않는다 (스펙 에러 케이스)', () => {
    const onStart = vi.fn()
    const { getByLabelText, getByRole, queryByRole } = render(
      <SeedSetup prefillSeed={null} onStart={onStart} />,
    )

    fireEvent.change(getByLabelText('우주 시드'), { target: { value: '한글 시드!' } })
    fireEvent.click(getByRole('button', { name: '이 우주로 출발' }))

    expect(onStart).not.toHaveBeenCalled()
    expect(getByRole('alert').textContent).toContain('영문자와 숫자')

    // 입력을 고치면 에러가 사라진다
    fireEvent.change(getByLabelText('우주 시드'), { target: { value: 'VALIDSEED' } })
    expect(queryByRole('alert')).toBeNull()
  })

  it('유효한 시드는 정규화되어 onStart로 전달된다', () => {
    const onStart = vi.fn()
    const { getByLabelText, getByRole } = render(<SeedSetup prefillSeed={null} onStart={onStart} />)

    fireEvent.change(getByLabelText('우주 시드'), { target: { value: '  Cosmos42  ' } })
    fireEvent.click(getByRole('button', { name: '이 우주로 출발' }))

    expect(onStart).toHaveBeenCalledWith('Cosmos42')
  })

  it('새 시드 버튼은 입력을 새 무작위 시드로 교체한다', () => {
    const { getByLabelText, getByRole } = render(<SeedSetup prefillSeed="OLD" onStart={vi.fn()} />)
    fireEvent.click(getByRole('button', { name: '🎲 새 시드' }))
    const value = (getByLabelText('우주 시드') as HTMLInputElement).value
    expect(value).not.toBe('OLD')
    expect(value).toMatch(/^[A-Za-z0-9]{12}$/)
  })
})
