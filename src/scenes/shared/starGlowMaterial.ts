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
  attribute float aCurrent;
  attribute float aFaint;
  uniform float uPixelRatio;
  uniform float uMaxPointSize;
  uniform float uMinPointSizePerUnit;
  uniform float uSoftNear;
  uniform float uSoftFar;
  uniform float uCurrentFade;
  uniform float uExtinction;
  uniform float uFaintMix;
  uniform float uDesaturate;
  varying vec3 vColor;
  varying float vSoftness;
  varying float vCurrentScale;
  varying float vExtinction;

  void main() {
    // 광도 멱법칙 (O-19) — aFaint(다수 어두움·소수 1)를 uFaintMix만큼 반영한다.
    // 함교(감상) 뷰 1 · 항법(도구) 뷰는 줌아웃 조망에서만 점진 적용 — 항행 거리 가독성 불변.
    float faint = mix(1.0, aFaint, uFaintMix);
    vColor = starColor * faint;
    // 사진 탈채도 (galaxy-realism-pass) — 줌아웃 조망에서 과장 팔레트(발견성용 채도)를
    // 실사진의 흰빛 중심 톤으로 눌러 "색종이 입자" 인상을 없앤다. 0이면 무영향.
    float luma = dot(vColor, vec3(0.299, 0.587, 0.114));
    vColor = mix(vColor, vec3(luma) * vec3(1.04, 0.99, 0.9), uDesaturate);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToCamera = max(-mvPosition.z, 1.0);

    // 성간 소광 (Beer–Lambert e^-τd) — 원반 내부 시점(함교)에서 원거리 별을 감광한다.
    // uExtinction=0이면 무영향 (항법 조망 뷰).
    vExtinction = exp(-uExtinction * distanceToCamera);

    // 0 = 근거리(샤프) ~ SOFT_MAX_BLEND = 원거리(소프트 글로우)
    vSoftness = uSoftFar > 0.0
      ? smoothstep(uSoftNear, uSoftFar, distanceToCamera) * ${SOFT_MAX_BLEND.toFixed(2)}
      : 0.0;

    // 어두운 별은 살짝 작게 — 사진의 "밝기 = 겉보기 크기" 문법 (하한 0.7, 완전 소실 방지)
    float faintSize = size * (0.7 + 0.3 * faint);
    float pointSize = faintSize * uPixelRatio * (${PERSPECTIVE_SCALE.toFixed(1)} / distanceToCamera);
    // 하한이 size에 비례 — 원거리에서도 거성/왜성의 크기 격차가 유지된다
    float minSize = uMinPointSizePerUnit * faintSize * uPixelRatio;
    float clamped = clamp(pointSize, minSize, uMaxPointSize * uPixelRatio);
    // 현재 별(aCurrent=1)만 카메라가 가까우면 사라진다 — 구체로 핸드오프 (결정 41-c).
    // 나머지 별(aCurrent=0)은 mix(1, fade, 0)=1로 무영향.
    float currentScale = mix(1.0, uCurrentFade, aCurrent);
    vCurrentScale = currentScale;
    // gl_PointSize=0은 WebGL1/모바일에서 미정의(1px로 클램프되어 점이 남는다) — 하한을 두고
    // 프래그먼트에서 명시적으로 discard한다.
    gl_PointSize = clamped * (1.0 + ${SOFT_SIZE_BOOST.toFixed(1)} * vSoftness) * max(currentScale, 0.001);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vSoftness;
  varying float vCurrentScale;
  varying float vExtinction;

  void main() {
    // 현재 별이 구체로 완전히 핸드오프된 상태 — 1px 클램프 잔상을 명시적으로 제거 (결정 41-c)
    if (vCurrentScale < 0.001) discard;
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
    gl_FragColor = vec4(shaded, alpha * uOpacity * vExtinction);
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
      // 현재 별 포인트 페이드 (1 = 보임). aCurrent 어트리뷰트가 없는 지오메트리는 무영향.
      uCurrentFade: { value: 1 },
      // 성간 소광 τ/유닛 — 0이면 비활성. GalaxyStarField가 뷰에 따라 설정한다.
      uExtinction: { value: 0 },
      // 광도 멱법칙 혼합 (O-19) — 0이면 비활성. aFaint 미설정 지오메트리(장식 별밭 등)는
      // 어트리뷰트가 0으로 읽히므로 반드시 0이어야 무영향이다.
      uFaintMix: { value: 0 },
      // 사진 탈채도 [0,1] — 줌아웃 조망 전용. 0이면 무영향.
      uDesaturate: { value: 0 },
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
