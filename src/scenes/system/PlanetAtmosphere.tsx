import { useEffect, useMemo } from 'react'
import { AdditiveBlending, Color, ShaderMaterial } from 'three'

import type { Planet } from '@/engine'

/**
 * 행성 대기 림 글로우 — 프레넬 셰이더 구 (백로그 F-1, 결정 29).
 * 실루엣 가장자리에서만 빛나는 가산 막이라 행성 디스크를 가리지 않는다.
 * 생명체 행성은 청록 대기를 강하게 — hasLife의 시각 신호다.
 */

/** 대기 구 반경 = 행성 시각 반경 × 이 배수. */
const ATMOSPHERE_SCALE = 1.16
const ATMOSPHERE_SEGMENTS = 32
/** 구름(renderOrder 1) 위에 가산되도록 마지막에 그린다. */
const ATMOSPHERE_RENDER_ORDER = 2
/** 림 집중도 — 클수록 글로우가 실루엣에 얇게 달라붙는다. */
const FRESNEL_POWER = 3.0

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
    float rim = pow(1.0 - facing, ${FRESNEL_POWER.toFixed(1)});
    gl_FragColor = vec4(uColor, rim * uIntensity);
  }
`

interface AtmosphereAppearance {
  readonly color: string
  readonly intensity: number
}

function atmosphereAppearance(planet: Planet): AtmosphereAppearance {
  if (planet.hasLife) {
    return { color: '#58ffd6', intensity: 0.85 }
  }
  if (planet.kind === 'gas') {
    return { color: `hsl(${planet.paletteSeed % 360}, 70%, 70%)`, intensity: 0.5 }
  }
  return { color: '#9fc3ff', intensity: 0.28 }
}

interface PlanetAtmosphereProps {
  readonly planet: Planet
  /** 행성 시각 반경 (월드 단위). */
  readonly radius: number
}

export function PlanetAtmosphere({ planet, radius }: PlanetAtmosphereProps) {
  const { color, intensity } = atmosphereAppearance(planet)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new Color(color) },
          uIntensity: { value: intensity },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [color, intensity],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material} renderOrder={ATMOSPHERE_RENDER_ORDER}>
      <sphereGeometry args={[radius * ATMOSPHERE_SCALE, ATMOSPHERE_SEGMENTS, ATMOSPHERE_SEGMENTS]} />
    </mesh>
  )
}
