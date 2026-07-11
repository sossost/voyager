import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CubeCamera, type Object3D, type Texture, WebGLCubeRenderTarget } from 'three'

/**
 * 블랙홀 렌즈 환경맵 (exotic-codex 렌즈 리팩터).
 *
 * 스크린공간 배경 샘플(inputBuffer)의 구조적 한계 — 화면 밖으로 휜 광선은 샘플할 것이
 * 없고(암흑 고리·스트릭), 전경/배경 분리를 깊이 해킹으로 우회(검은 호·유령 링·이음선) —
 * 를 근본 해소한다: 원거리 배경만 담은 큐브맵을 계 진입 시 1회 베이크하고, 레이마칭의
 * 탈출 광선은 이 환경맵을 방향으로 샘플한다. 배경은 사실상 무한원이라 베이크가 유효하다.
 *
 * 대상 선별은 three.js 레이어(LENS_ENV_LAYER) — **저주파 확산광**(은하 글로우·성운·원거리
 * 은하)만 굽는다. 점광 별밭은 제외 — 래스터에 구우면 렌즈 확대율이 텍셀을 이겨 뭉개진다.
 * 별은 셰이더의 절차 별밭(방향 해시 = 해상도 무한)이 담당한다 (하이브리드 하늘).
 * 근거리(항성계 본체·우주선)도 제외 — 렌즈 이중 샘플·유령 방지.
 */

export const LENS_ENV_LAYER = 2

/** 렌더 ↔ 포스트 패스 공유 상태 (blackHoleLens 패턴 — 철칙 6). */
export const lensEnv = {
  texture: null as Texture | null,
  ready: false,
}

/** JSX onUpdate 헬퍼 — 원거리 배경 오브젝트에 환경맵 레이어를 켠다 (기본 레이어 유지). */
export function enableLensEnvLayer(object: Object3D | null): void {
  object?.layers.enable(LENS_ENV_LAYER)
}

const ENV_SIZE = 256
/** 마운트 직후 씬이 채워질 시간 — 이 프레임 수만큼 기다렸다 베이크한다. */
const BAKE_DELAY_FRAMES = 6

interface LensEnvironmentBakerProps {
  /** 베이크 시점(월드) — 현재 별 위치. 렌즈 광선이 탈출하는 기준점. */
  readonly anchor: readonly [number, number, number]
  /** 블랙홀 계에서만 베이크한다 (환경맵 소비자가 렌즈뿐). */
  readonly active: boolean
  /** 배경 구성 식별자 — 별·뷰가 바뀌면 재베이크 (뷰별로 마운트되는 배경이 다르다). */
  readonly bakeKey: string
}

export function LensEnvironmentBaker({ anchor, active, bakeKey }: LensEnvironmentBakerProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  const renderTarget = useMemo(() => new WebGLCubeRenderTarget(ENV_SIZE), [])
  const cubeCamera = useMemo(() => {
    const camera = new CubeCamera(1, 60_000, renderTarget)
    // 6면 카메라 전부 환경맵 레이어만 보게 — 근거리(기본 레이어 전용)는 베이크에서 제외.
    for (const face of camera.children) face.layers.set(LENS_ENV_LAYER)
    return camera
  }, [renderTarget])

  const pendingRef = useRef<{ key: string; frames: number } | null>(null)
  const bakedKeyRef = useRef<string | null>(null)

  useFrame(() => {
    if (!active) return
    if (bakedKeyRef.current === bakeKey) return
    const pending = pendingRef.current
    if (pending == null || pending.key !== bakeKey) {
      pendingRef.current = { key: bakeKey, frames: 0 }
      return
    }
    pending.frames += 1
    if (pending.frames < BAKE_DELAY_FRAMES) return

    cubeCamera.position.set(anchor[0], anchor[1], anchor[2])
    cubeCamera.update(gl, scene)
    lensEnv.texture = renderTarget.texture
    lensEnv.ready = true
    bakedKeyRef.current = bakeKey
  })

  useEffect(() => {
    return () => {
      renderTarget.dispose()
      lensEnv.texture = null
      lensEnv.ready = false
    }
  }, [renderTarget])

  return null
}
