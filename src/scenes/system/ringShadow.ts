import type { WebGLProgramParametersWithUniforms } from 'three'
import { Vector3 } from 'three'

import { getRingTexture } from '@/scenes/system/ringTexture'

/**
 * 행성 표면의 고리 그림자 띠 (O-3) — 토성 시그니처.
 *
 * 표면 재질(meshStandardMaterial)에 onBeforeCompile로 해석 판정을 주입한다:
 * 프래그먼트→별 광선이 고리 평면과 교차하고 교차 반경이 고리 애뉼러스 [inner, outer] 안이면,
 * 그 반경의 고리 텍스처 알파(밀도)만큼 직사광을 감쇠한다 — 카시니 간극·엥케 간극은
 * 그림자에도 밝은 줄로 나타난다. 그림자맵 불필요, 렌더 전용 — GEN_VERSION 무관.
 *
 * 유니폼(별·행성 월드 좌표, 고리 반경)은 Planet의 useFrame이 매 프레임 갱신한다.
 * 광원은 주성 1개만 반영한다 (PlanetRings·AtmosphereLimb와 동일한 근사).
 */

/** 고리 그림자 속에 남는 빛 비율 — 주변광·간접광 몫. 0이면 띠가 완전 검정이 되어 부자연. */
const RING_SHADOW_FLOOR = 0.25

export interface RingShadowUniforms {
  /** 주성 월드 좌표 — 매 프레임 갱신. */
  readonly starPos: Vector3
  /** 행성(=고리) 중심 월드 좌표 — 매 프레임 갱신. */
  readonly ringCenter: Vector3
  /** 고리면 월드 노멀 — 상수(RING_PLANE_NORMAL). */
  readonly ringNormal: Vector3
  /** 고리 안/바깥 모서리 월드 반경 — 매 프레임 갱신 (뷰 스케일 반영). */
  readonly ringInner: { value: number }
  readonly ringOuter: { value: number }
}

export function createRingShadowUniforms(ringNormal: Vector3): RingShadowUniforms {
  return {
    starPos: new Vector3(0, 0, 0),
    ringCenter: new Vector3(),
    ringNormal: ringNormal.clone(),
    ringInner: { value: 1 },
    ringOuter: { value: 2 },
  }
}

const VERTEX_DECLARATIONS = /* glsl */ `
  #include <common>
  varying vec3 vRingShadowWorldPos;
`

const VERTEX_WORLDPOS = /* glsl */ `
  #include <worldpos_vertex>
  vRingShadowWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const FRAGMENT_DECLARATIONS = /* glsl */ `
  #include <common>
  uniform sampler2D uRingShadowMap;
  uniform vec3 uRingShadowStar;
  uniform vec3 uRingShadowCenter;
  uniform vec3 uRingShadowNormal;
  uniform float uRingShadowInner;
  uniform float uRingShadowOuter;
  varying vec3 vRingShadowWorldPos;

  // 고리 그림자 밀도 [0,1] — 프래그먼트→별 광선의 고리 평면 교차점을 애뉼러스에 사상해
  // 고리 텍스처 알파를 샘플한다. 교차가 없거나 애뉼러스 밖이면 0.
  float ringShadowDensity(vec3 p) {
    vec3 toStar = uRingShadowStar - p;
    float denom = dot(toStar, uRingShadowNormal);
    if (abs(denom) < 1e-5) return 0.0;
    float t = dot(uRingShadowCenter - p, uRingShadowNormal) / denom;
    if (t <= 0.0 || t >= 1.0) return 0.0;
    vec3 hit = p + toStar * t;
    float radius = length(hit - uRingShadowCenter);
    float radial = (radius - uRingShadowInner) / (uRingShadowOuter - uRingShadowInner);
    if (radial < 0.0 || radial > 1.0) return 0.0;
    return texture2D(uRingShadowMap, vec2(radial, 0.5)).a;
  }
`

const FRAGMENT_APPLY = /* glsl */ `
  gl_FragColor.rgb *= mix(1.0, ${RING_SHADOW_FLOOR.toFixed(2)}, ringShadowDensity(vRingShadowWorldPos));
  #include <dithering_fragment>
`

/**
 * meshStandardMaterial의 onBeforeCompile 핸들러 — 고리 그림자 판정을 주입한다.
 * three는 onBeforeCompile 내용(customProgramCacheKey 기본값)으로 프로그램을 캐시하므로
 * 고리 있는 행성끼리는 프로그램을 공유하고, 유니폼만 머티리얼별로 분리된다.
 */
export function injectRingShadow(
  shader: WebGLProgramParametersWithUniforms,
  uniforms: RingShadowUniforms,
): void {
  shader.uniforms.uRingShadowMap = { value: getRingTexture() }
  shader.uniforms.uRingShadowStar = { value: uniforms.starPos }
  shader.uniforms.uRingShadowCenter = { value: uniforms.ringCenter }
  shader.uniforms.uRingShadowNormal = { value: uniforms.ringNormal }
  shader.uniforms.uRingShadowInner = uniforms.ringInner
  shader.uniforms.uRingShadowOuter = uniforms.ringOuter

  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', VERTEX_DECLARATIONS)
    .replace('#include <worldpos_vertex>', VERTEX_WORLDPOS)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', FRAGMENT_DECLARATIONS)
    .replace('#include <dithering_fragment>', FRAGMENT_APPLY)
}
