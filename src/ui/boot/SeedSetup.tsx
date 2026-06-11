import { useState } from 'react'

import type { Seed } from '@/engine'
import { parseSeed } from '@/engine'
import { generateRandomSeed } from '@/ui/boot/generateRandomSeed'

interface SeedSetupProps {
  /** ?seed= 딥링크 프리필 — 친구가 공유한 우주. */
  readonly prefillSeed: string | null
  onStart(seed: Seed): void
}

/** 첫 실행 온보딩 — 시드 자동 생성 또는 직접 입력 (1~32자 영숫자, 인라인 검증). */
export function SeedSetup({ prefillSeed, onStart }: SeedSetupProps) {
  const [input, setInput] = useState(prefillSeed ?? generateRandomSeed())
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const seed = parseSeed(input)
    if (seed == null) {
      // 유효하지 않은 입력 — 인라인 에러, 게임 상태는 불변 (스펙 에러 케이스)
      setError('시드는 1~32자의 영문자와 숫자만 사용할 수 있어요')
      return
    }
    onStart(seed)
  }

  return (
    <main className="boot-screen">
      <h1 className="boot-title">Stellar Voyage</h1>
      <p className="boot-subtitle">
        시드가 우주를 결정합니다 — 같은 시드는 언제나 같은 은하, 같은 행성, 같은 생명체를
        만듭니다.
      </p>

      <form className="seed-form" onSubmit={handleSubmit} noValidate>
        <label className="seed-label" htmlFor="seed-input">
          우주 시드
        </label>
        <div className="seed-input-row">
          <input
            id="seed-input"
            className={error == null ? 'seed-input' : 'seed-input seed-input-invalid'}
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setError(null)
            }}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : 'seed-error'}
          />
          <button
            type="button"
            className="hud-button"
            onClick={() => {
              setInput(generateRandomSeed())
              setError(null)
            }}
          >
            🎲 새 시드
          </button>
        </div>
        {error != null ? (
          <p id="seed-error" className="seed-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="hud-button hud-button-primary boot-start-button">
          이 우주로 출발
        </button>
      </form>
    </main>
  )
}
