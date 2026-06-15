import { wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, Effect } from 'postprocessing'
import { Uniform, Vector2, type WebGLRenderTarget, type WebGLRenderer } from 'three'

import { blackHoleLens } from '@/scenes/system/blackHoleLens'

/**
 * 블랙홀 중력렌즈 — 화면공간 굴절 포스트 패스 (결정 5의 high 티어 후순위 사치).
 *
 * 렌더된 장면(배경 별 + 강착원반)을 사건지평선 둘레로 휘어 빨아들이듯 굴절시키고(아인슈타인 링·
 * 확대), 안쪽은 검은 그림자로 둔다 — 인터스텔라 가르강튀아 룩. `mainUv`로 입력 샘플 좌표를 중력
 * 굴절식(광자구 근처 강하게, 1/dist² 감쇠)으로 당기고, `mainImage`로 포톤 링을 더한다.
 *
 * 활성은 CurrentSystem이 게시하는 blackHoleLens.active(현재 별=블랙홀 && LOD 안)일 때만 —
 * 그 외엔 uActive=0으로 패스스루(거의 무비용). high 티어(EffectComposer) 전용.
 */

const FRAGMENT = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uAspect;
  uniform float uStrength;
  uniform float uActive;

  // 화면 비율 보정(세로 UV 기준 등방) 좌표
  vec2 toAspect(vec2 p) { return vec2(p.x * uAspect, p.y); }

  void mainUv(inout vec2 uv) {
    if (uActive < 0.5) return;
    vec2 d = toAspect(uv - uCenter);
    float dist = length(d);
    if (dist < 1e-4) return;
    float rs = uRadius;
    // 중력 굴절량 — 광자구 근처에서 강하고 1/dist²로 감쇠. 중심을 넘지 않게 클램프.
    float deflect = min(uStrength * rs * rs / (dist * dist), dist * 0.92);
    vec2 dir = d / dist;
    vec2 off = vec2(dir.x / uAspect, dir.y) * deflect;
    uv -= off; // 소스(중심) 쪽에서 당겨와 휘게 — 확대·아인슈타인 링
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
    if (uActive < 0.5) return;
    vec2 d = toAspect(vUv - uCenter); // 원래 화면 좌표(vUv) 기준
    float dist = length(d);
    float rs = uRadius;
    if (dist < rs) { outputColor = vec4(0.0, 0.0, 0.0, 1.0); return; } // 사건지평선 그림자
    // 아인슈타인(포톤) 링 — 광자구 바로 바깥의 밝은 띠
    float rd = (dist - rs * 1.05) / (rs * 0.06);
    float ring = exp(-rd * rd);
    outputColor.rgb += vec3(1.0, 0.93, 0.8) * ring * 0.85;
  }
`

class BlackHoleLensingImpl extends Effect {
  constructor() {
    super('BlackHoleLensing', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number | Vector2>>([
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ['uRadius', new Uniform(0)],
        ['uAspect', new Uniform(1)],
        ['uStrength', new Uniform(0)],
        ['uActive', new Uniform(0)],
      ]),
    })
  }

  override update(_renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget): void {
    const uniforms = this.uniforms as Map<string, Uniform<number | Vector2>>
    const center = uniforms.get('uCenter')
    if (center != null) (center.value as Vector2).copy(blackHoleLens.center)
    const radius = uniforms.get('uRadius')
    if (radius != null) radius.value = blackHoleLens.radius
    const strength = uniforms.get('uStrength')
    if (strength != null) strength.value = blackHoleLens.strength
    const active = uniforms.get('uActive')
    if (active != null) active.value = blackHoleLens.active ? 1 : 0
    const aspect = uniforms.get('uAspect')
    if (aspect != null && inputBuffer.height > 0) {
      aspect.value = inputBuffer.width / inputBuffer.height
    }
  }
}

export const BlackHoleLensing = wrapEffect(BlackHoleLensingImpl)
