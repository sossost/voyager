import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import { parseSeed, rngFor } from '@/engine'
import { cyrb128 } from '@/engine/rng/cyrb128'

/**
 * PRNG 원시 출력 골든 마스터 — 결정론의 최하층 봉인.
 *
 * 이 스냅샷이 깨졌다면 cyrb128/sfc32/rngFor 중 무언가가 변경된 것이고,
 * 그 변경은 우주 전체를 파괴한다. 의도적 변경이라면 GEN_VERSION을 올리고
 * 02-decisions.md에 사유를 기록한 뒤 스냅샷을 갱신하라.
 */

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

describe('PRNG 골든 마스터', () => {
  it('cyrb128: 고정 입력의 해시가 영구히 같다', () => {
    expect(cyrb128('')).toMatchSnapshot()
    expect(cyrb128('stellar-voyage')).toMatchSnapshot()
    expect(cyrb128('ANDROMEDAsector000')).toMatchSnapshot()
  })

  it('rngFor: 고정 스트림의 첫 1000개 출력 해시가 영구히 같다', () => {
    const rng = rngFor(seedOf('GOLDEN'), 'sector', 0, 0, 0)
    const outputs = Array.from({ length: 1_000 }, () => rng.next())

    // 진단용 원시 샘플 — 해시만으로는 무엇이 깨졌는지 알 수 없다
    expect(outputs.slice(0, 8)).toMatchSnapshot('first-8-outputs')
    // 1000개 전체의 지문
    expect(cyrb128(outputs.join(','))).toMatchSnapshot('digest-of-1000')
  })

  it('rngFor: 네임스페이스별 첫 출력이 영구히 같다', () => {
    const seed = seedOf('GOLDEN')
    const firstOutputs = {
      sector: rngFor(seed, 'sector', 1, 2, 3).next(),
      star: rngFor(seed, 'star', '1:2:3:0').next(),
      planets: rngFor(seed, 'planets', '1:2:3:0').next(),
      planet: rngFor(seed, 'planet', '1:2:3:0:p0').next(),
      alien: rngFor(seed, 'alien', '1:2:3:0:p0').next(),
      name: rngFor(seed, 'name', '1:2:3:0').next(),
    }
    expect(firstOutputs).toMatchSnapshot()
  })
})
