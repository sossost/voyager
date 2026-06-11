import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three'

/**
 * 별 포인트 공용 머티리얼 — GalaxyStarField(별)와 GalaxyBackdrop(원경 성운)이 공유.
 * 텍스처 페치 없는 라디얼 셰이딩 + gl_PointSize 상한(fill-rate 캡, 결정 12).
 *
 * 프로파일 (fragment 선택):
 *   - 'glow': 부드러운 라디얼 글로우 — 성운 백드롭용
 *   - 'star': 단단한 코어 + 옅은 헤일로 — 또렷한 별용
 *
 * 선택적 구형 페이드: uFadeOuter > 0이면 uFadeCenter 기준 거리로 알파를 조절한다.
 *   - fadeInvert=false: 멀수록 사라짐
 *   - fadeInvert=true:  가까울수록 사라짐 — 카메라 코앞의 원경 글로우 블롭을 숨긴다 (백드롭)
 * 기본값 0 = 비활성.
 */

/** 원근 크기 계수 — 이 거리(월드 단위)에서 size 어트리뷰트가 1:1 픽셀이 된다. */
const PERSPECTIVE_SCALE = 700

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute vec3 starColor;
  uniform float uPixelRatio;
  uniform float uMaxPointSize;
  uniform float uMinPointSize;
  uniform vec3 uFadeCenter;
  uniform float uFadeInner;
  uniform float uFadeOuter;
  uniform float uFadeInvert;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = starColor;
    float fadeByDistance = smoothstep(uFadeInner, uFadeOuter, distance(position, uFadeCenter));
    vFade = uFadeOuter > 0.0
      ? mix(1.0 - fadeByDistance, fadeByDistance, uFadeInvert)
      : 1.0;

    // 완전히 페이드된 점은 클립 밖으로 보내 프래그먼트 비용을 없앤다
    if (vFade <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToCamera = max(-mvPosition.z, 1.0);
    float pointSize = size * uPixelRatio * (${PERSPECTIVE_SCALE.toFixed(1)} / distanceToCamera);
    gl_PointSize = clamp(pointSize, uMinPointSize * uPixelRatio, uMaxPointSize * uPixelRatio);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_GLOW = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float normalizedDistance = length(fromCenter) * 2.0;
    float glow = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    glow = glow * glow;
    gl_FragColor = vec4(vColor * (0.4 + 0.6 * glow), glow * uOpacity * vFade);
  }
`

/** 단단한 코어 + 옅은 헤일로 — 별이 블러 없이 또렷한 점광원으로 읽힌다. */
const FRAGMENT_STAR = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float normalizedDistance = length(fromCenter) * 2.0;
    float core = clamp(1.0 - normalizedDistance * 2.2, 0.0, 1.0);
    core = core * (2.0 - core);
    float halo = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    halo = halo * halo * halo * 0.3;
    gl_FragColor = vec4(vColor * (0.8 + 0.2 * core), max(core, halo) * uOpacity * vFade);
  }
`

export interface StarGlowMaterialOptions {
  readonly maxPointSize: number
  readonly initialOpacity?: number
  /** 'glow' 부드러운 성운(기본) / 'star' 또렷한 별. */
  readonly profile?: 'glow' | 'star'
  /** 점 크기 하한 (px) — 원거리 별이 서브픽셀로 사라지지 않게 한다. */
  readonly minPointSize?: number
  /** 구형 페이드 시작/소멸 반경 (월드 단위). 생략하면 페이드 없음. */
  readonly fadeInner?: number
  readonly fadeOuter?: number
  /** true면 페이드 방향 반전 — uFadeCenter에 가까울수록 투명해진다. */
  readonly fadeInvert?: boolean
}

export function createStarGlowMaterial({
  maxPointSize,
  initialOpacity = 0,
  profile = 'glow',
  minPointSize = 0,
  fadeInner = 0,
  fadeOuter = 0,
  fadeInvert = false,
}: StarGlowMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: profile === 'star' ? FRAGMENT_STAR : FRAGMENT_GLOW,
    uniforms: {
      uOpacity: { value: initialOpacity },
      uPixelRatio: { value: 1 },
      uMaxPointSize: { value: maxPointSize },
      uMinPointSize: { value: minPointSize },
      uFadeCenter: { value: new Vector3() },
      uFadeInner: { value: fadeInner },
      uFadeOuter: { value: fadeOuter },
      uFadeInvert: { value: fadeInvert ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

export function setUniform(material: ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name]
  if (uniform == null) return
  uniform.value = value
}

export function setVector3Uniform(
  material: ShaderMaterial,
  name: string,
  x: number,
  y: number,
  z: number,
): void {
  const uniform = material.uniforms[name]
  if (uniform == null || !(uniform.value instanceof Vector3)) return
  uniform.value.set(x, y, z)
}
