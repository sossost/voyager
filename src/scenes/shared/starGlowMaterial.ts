import { AdditiveBlending, ShaderMaterial } from 'three'

/**
 * 별 글로우 공용 머티리얼 — SectorPoints(근경)와 GalaxyBackdrop(원경)이 공유.
 * 텍스처 페치 없는 라디얼 글로우 + gl_PointSize 상한(fill-rate 캡, 결정 12).
 */

/** 원근 크기 계수 — 이 거리(월드 단위)에서 size 어트리뷰트가 1:1 픽셀이 된다. */
const PERSPECTIVE_SCALE = 700

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute vec3 starColor;
  uniform float uPixelRatio;
  uniform float uMaxPointSize;
  varying vec3 vColor;

  void main() {
    vColor = starColor;
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

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float normalizedDistance = length(fromCenter) * 2.0;
    float glow = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    glow = glow * glow;
    gl_FragColor = vec4(vColor * (0.4 + 0.6 * glow), glow * uOpacity);
  }
`

export interface StarGlowMaterialOptions {
  readonly maxPointSize: number
  readonly initialOpacity?: number
}

export function createStarGlowMaterial({
  maxPointSize,
  initialOpacity = 0,
}: StarGlowMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uOpacity: { value: initialOpacity },
      uPixelRatio: { value: 1 },
      uMaxPointSize: { value: maxPointSize },
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
