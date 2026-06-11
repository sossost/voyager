import { AdditiveBlending, ShaderMaterial } from 'three'

/**
 * 별 포인트 공용 머티리얼 — GalaxyStarField가 사용, setUniform은 WarpStreaks도 공유.
 * 텍스처 페치 없는 라디얼 셰이딩 + gl_PointSize 상·하한(fill-rate 캡 + 원거리 가시성, 결정 12·22).
 *
 * 거리 적응형 포커스: 카메라에 가까운 별은 단단한 코어의 점광원으로,
 * 먼 별은 부드러운 글로우로 렌더된다 (uSoftNear → uSoftFar 구간에서 전환).
 * uSoftFar = 0이면 항상 샤프.
 */

/** 원근 크기 계수 — 이 거리(월드 단위)에서 size 어트리뷰트가 1:1 픽셀이 된다. */
const PERSPECTIVE_SCALE = 700
/** 소프트 전환 시 점 크기 가산 비율 — 글로우가 퍼져 보이도록 살짝 부풀린다. */
const SOFT_SIZE_BOOST = 0.35
/** 소프트 블렌딩 상한 — 1이면 원거리 별이 완전한 글로우가 되어 너무 뭉개진다. */
const SOFT_MAX_BLEND = 0.65

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute vec3 starColor;
  uniform float uPixelRatio;
  uniform float uMaxPointSize;
  uniform float uMinPointSizePerUnit;
  uniform float uSoftNear;
  uniform float uSoftFar;
  varying vec3 vColor;
  varying float vSoftness;

  void main() {
    vColor = starColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToCamera = max(-mvPosition.z, 1.0);

    // 0 = 근거리(샤프) ~ SOFT_MAX_BLEND = 원거리(소프트 글로우)
    vSoftness = uSoftFar > 0.0
      ? smoothstep(uSoftNear, uSoftFar, distanceToCamera) * ${SOFT_MAX_BLEND.toFixed(2)}
      : 0.0;

    float pointSize = size * uPixelRatio * (${PERSPECTIVE_SCALE.toFixed(1)} / distanceToCamera);
    // 하한이 size에 비례 — 원거리에서도 거성/왜성의 크기 격차가 유지된다
    float minSize = uMinPointSizePerUnit * size * uPixelRatio;
    float clamped = clamp(pointSize, minSize, uMaxPointSize * uPixelRatio);
    gl_PointSize = clamped * (1.0 + ${SOFT_SIZE_BOOST.toFixed(1)} * vSoftness);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vSoftness;

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float normalizedDistance = length(fromCenter) * 2.0;

    // 샤프: 단단한 코어 + 옅은 헤일로 — 블러 없는 점광원
    float core = clamp(1.0 - normalizedDistance * 2.2, 0.0, 1.0);
    core = core * (2.0 - core);
    float halo = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    halo = halo * halo * halo * 0.3;
    float sharpAlpha = max(core, halo);

    // 소프트: 라디얼 글로우 — 원거리에서 성운처럼 뭉친다
    float glow = clamp(1.0 - normalizedDistance, 0.0, 1.0);
    glow = glow * glow;

    float alpha = mix(sharpAlpha, glow, vSoftness);
    vec3 shaded = vColor * mix(0.8 + 0.2 * core, 0.45 + 0.55 * glow, vSoftness);
    gl_FragColor = vec4(shaded, alpha * uOpacity);
  }
`

export interface StarGlowMaterialOptions {
  readonly maxPointSize: number
  readonly initialOpacity?: number
  /** size 어트리뷰트 1단위당 점 크기 하한 (px) — 원거리에서도 크기 격차를 유지한다. */
  readonly minPointSizePerUnit?: number
  /** 샤프 → 소프트 전환 시작/완료 카메라 거리 (월드 단위). 생략하면 항상 샤프. */
  readonly softNear?: number
  readonly softFar?: number
}

export function createStarGlowMaterial({
  maxPointSize,
  initialOpacity = 0,
  minPointSizePerUnit = 0,
  softNear = 0,
  softFar = 0,
}: StarGlowMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uOpacity: { value: initialOpacity },
      uPixelRatio: { value: 1 },
      uMaxPointSize: { value: maxPointSize },
      uMinPointSizePerUnit: { value: minPointSizePerUnit },
      uSoftNear: { value: softNear },
      uSoftFar: { value: softFar },
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
