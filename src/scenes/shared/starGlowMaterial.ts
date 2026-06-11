import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three'

/**
 * 별 글로우 공용 머티리얼 — SectorPoints(근경)와 GalaxyBackdrop(원경)이 공유.
 * 텍스처 페치 없는 라디얼 글로우 + gl_PointSize 상한(fill-rate 캡, 결정 12).
 *
 * 선택적 구형 페이드: uFadeOuter > 0이면 uFadeCenter 기준 거리로 알파를 조절한다.
 *   - fadeInvert=false: 멀수록 사라짐 — 섹터 로드 큐브 경계를 부드러운 구로 만든다 (근경 별)
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
    gl_PointSize = min(pointSize, uMaxPointSize * uPixelRatio);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
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

export interface StarGlowMaterialOptions {
  readonly maxPointSize: number
  readonly initialOpacity?: number
  /** 구형 페이드 시작/소멸 반경 (월드 단위). 생략하면 페이드 없음. */
  readonly fadeInner?: number
  readonly fadeOuter?: number
  /** true면 페이드 방향 반전 — uFadeCenter에 가까울수록 투명해진다. */
  readonly fadeInvert?: boolean
}

export function createStarGlowMaterial({
  maxPointSize,
  initialOpacity = 0,
  fadeInner = 0,
  fadeOuter = 0,
  fadeInvert = false,
}: StarGlowMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uOpacity: { value: initialOpacity },
      uPixelRatio: { value: 1 },
      uMaxPointSize: { value: maxPointSize },
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
