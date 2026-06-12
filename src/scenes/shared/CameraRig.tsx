import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/** 초점이 은하 중심급일 때의 기본 진입 오프셋 (나선 전체 조망). */
const DEFAULT_OFFSET_Y = 180
const DEFAULT_OFFSET_Z = 320

interface CameraRigProps {
  /** 카메라가 공전할 초점 (보통 현재 별의 월드 좌표). */
  readonly focus: readonly [number, number, number]
  readonly minDistance?: number
  readonly maxDistance?: number
  /** 진입 시 카메라를 focus에서 이만큼 띄운다 — 작은 대상(우주선)엔 가깝게. */
  readonly offsetY?: number
  readonly offsetZ?: number
}

/**
 * 공용 카메라 리그 — 마우스 회전/줌/팬 + 터치 드래그/핀치 (OrbitControls 내장).
 * makeDefault로 등록되어 씬 컴포넌트들이 state.controls를 읽을 수 있다.
 */
export function CameraRig({
  focus,
  minDistance = 15,
  maxDistance = 1600,
  offsetY = DEFAULT_OFFSET_Y,
  offsetZ = DEFAULT_OFFSET_Z,
}: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  // 좌표 값 기준 의존성 — focus 배열의 참조가 바뀌어도 값이 같으면 스냅하지 않는다
  // (워프 중 GalaxyScene 리렌더가 플레이어의 궤도 포즈를 초기화하면 안 된다)
  const [focusX, focusY, focusZ] = focus

  useEffect(() => {
    camera.position.set(focusX, focusY + offsetY, focusZ + offsetZ)
    if (controlsRef.current != null) {
      controlsRef.current.target.set(focusX, focusY, focusZ)
      controlsRef.current.update()
    }
  }, [camera, focusX, focusY, focusZ, offsetY, offsetZ])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  )
}
