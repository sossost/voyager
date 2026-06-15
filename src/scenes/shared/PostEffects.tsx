import { Bloom, EffectComposer } from '@react-three/postprocessing'

import { BlackHoleLensing } from '@/scenes/shared/BlackHoleLensingEffect'

/**
 * high 티어 전용 포스트 이펙트 — 항성 발광·워프 플래시 블룸 (결정 12) + 블랙홀 중력렌즈.
 * 동적 로드(lazy)되므로 medium/low 기기는 이 번들을 받지 않는다.
 *
 * 렌즈는 블랙홀에 근접했을 때만 활성(blackHoleLens.active) — 그 외엔 패스스루(거의 무비용).
 * Bloom 앞에 두어 굴절된 결과를 블룸한다.
 */
export function PostEffects() {
  return (
    <EffectComposer>
      <BlackHoleLensing />
      <Bloom intensity={0.55} luminanceThreshold={0.3} luminanceSmoothing={0.6} mipmapBlur />
    </EffectComposer>
  )
}

export default PostEffects
