import { AdditiveBlending, ShaderMaterial } from 'three'

/**
 * 별 포인트 공용 머티리얼 — GalaxyStarField가 사용, setUniform은 WarpStreaks도 공유.
 * 텍스처 페치 없는 라디얼 셰이딩 + gl_PointSize 상·하한(fill-rate 캡 + 원거리 가시성, 결정 12·22).
 *
 * 프로파일 (fragment 선택):
 *   - 'glow': 부드러운 라디얼 글로우
 *   - 'star': 단단한 코어 + 옅은 헤일로 — 또렷한 별용
 */

/** 원근 크기 계수 — 이 거리(월드 단위)에서 size 어트리뷰트가 1:1 픽셀이 된다. */
const PERSPECTIVE_SCALE = 700

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute vec3 starColor;
  uniform float uPixelRatio;
  uniform float uMaxPointSize;
  uniform float uMinPointSize;
  varying vec3 vColor;

  void main() {
    vColor = starColor;
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

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float normalizedDistance = length(fromCenter) * 2.0;
    float glow = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    glow = glow * glow;
    gl_FragColor = vec4(vColor * (0.4 + 0.6 * glow), glow * uOpacity);
  }
`

/** 단단한 코어 + 옅은 헤일로 — 별이 블러 없이 또렷한 점광원으로 읽힌다. */
const FRAGMENT_STAR = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float normalizedDistance = length(fromCenter) * 2.0;
    float core = clamp(1.0 - normalizedDistance * 2.2, 0.0, 1.0);
    core = core * (2.0 - core);
    float halo = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    halo = halo * halo * halo * 0.3;
    gl_FragColor = vec4(vColor * (0.8 + 0.2 * core), max(core, halo) * uOpacity);
  }
`

export interface StarGlowMaterialOptions {
  readonly maxPointSize: number
  readonly initialOpacity?: number
  /** 'glow' 부드러운 글로우(기본) / 'star' 또렷한 별. */
  readonly profile?: 'glow' | 'star'
  /** 점 크기 하한 (px) — 원거리 별이 서브픽셀로 사라지지 않게 한다. */
  readonly minPointSize?: number
}

export function createStarGlowMaterial({
  maxPointSize,
  initialOpacity = 0,
  profile = 'glow',
  minPointSize = 0,
}: StarGlowMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: profile === 'star' ? FRAGMENT_STAR : FRAGMENT_GLOW,
    uniforms: {
      uOpacity: { value: initialOpacity },
      uPixelRatio: { value: 1 },
      uMaxPointSize: { value: maxPointSize },
      uMinPointSize: { value: minPointSize },
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
