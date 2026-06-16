import { Bloom, EffectComposer } from '@react-three/postprocessing'

import { QUALITY_PRESETS } from '@/quality/presets'
import { BlackHoleRayMarch } from '@/scenes/shared/BlackHoleRayMarchEffect'
import { useGameStore } from '@/store'

/**
 * 포스트 이펙트 — 블랙홀 레이마칭 중력렌즈(모든 티어, 스텝/SS는 티어별로 낮춤) + 블룸(high 전용).
 *
 * 레이마칭 렌즈는 블랙홀에 근접했을 때만 활성(blackHoleLens.active) — 그 외엔 패스스루.
 * 마운트 자체도 high(블룸 상시) 또는 블랙홀 정박 시에만 (CanvasLayer). Bloom 앞에 두어
 * 굴절된 강착원반을 블룸한다(인터스텔라식 발광). medium/low는 블룸 없이 렌즈만.
 */
export function PostEffects() {
  const qualityTier = useGameStore((state) => state.qualityTier)
  const enableBloom = QUALITY_PRESETS[qualityTier].bloom

  // medium·low는 블룸 없이 렌즈만 (EffectComposer 자식 타입이 falsy를 막아 분기로 나눈다).
  if (!enableBloom) {
    return (
      <EffectComposer>
        <BlackHoleRayMarch />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer>
      <BlackHoleRayMarch />
      <Bloom intensity={0.55} luminanceThreshold={0.3} luminanceSmoothing={0.6} mipmapBlur />
    </EffectComposer>
  )
}

export default PostEffects
