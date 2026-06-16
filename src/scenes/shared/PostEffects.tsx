import { Bloom, EffectComposer } from '@react-three/postprocessing'

import { BlackHoleRayMarch } from '@/scenes/shared/BlackHoleRayMarchEffect'

/**
 * high 티어 전용 포스트 이펙트 — 항성 발광·워프 플래시 블룸 (결정 12) + 블랙홀 측지선 중력렌즈.
 * 동적 로드(lazy)되므로 medium/low 기기는 이 번들을 받지 않는다.
 *
 * 레이마칭 렌즈는 블랙홀에 근접했을 때만 활성(blackHoleLens.active) — 그 외엔 패스스루.
 * Bloom 앞에 두어 굴절된 강착원반을 블룸한다(인터스텔라식 발광).
 * (이전 화면공간 근사 BlackHoleLensingEffect는 보존 — 롤백용.)
 */
export function PostEffects() {
  return (
    <EffectComposer>
      <BlackHoleRayMarch />
      <Bloom intensity={0.55} luminanceThreshold={0.3} luminanceSmoothing={0.6} mipmapBlur />
    </EffectComposer>
  )
}

export default PostEffects
