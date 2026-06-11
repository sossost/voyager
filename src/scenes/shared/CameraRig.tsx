import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

const CAMERA_OFFSET = { y: 180, z: 320 } as const

interface CameraRigProps {
  /** 카메라가 공전할 초점 (보통 현재 별의 월드 좌표). */
  readonly focus: readonly [number, number, number]
  readonly minDistance?: number
  readonly maxDistance?: number
}

/**
 * 공용 카메라 리그 — 마우스 회전/줌/팬 + 터치 드래그/핀치 (OrbitControls 내장).
 * makeDefault로 등록되어 씬 컴포넌트들이 state.controls를 읽을 수 있다.
 */
export function CameraRig({ focus, minDistance = 15, maxDistance = 1600 }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  // 좌표 값 기준 의존성 — focus 배열의 참조가 바뀌어도 값이 같으면 스냅하지 않는다
  // (워프 중 GalaxyScene 리렌더가 플레이어의 궤도 포즈를 초기화하면 안 된다)
  const [focusX, focusY, focusZ] = focus

  useEffect(() => {
    camera.position.set(focusX, focusY + CAMERA_OFFSET.y, focusZ + CAMERA_OFFSET.z)
  }, [camera, focusX, focusY, focusZ])

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      target={[focusX, focusY, focusZ]}
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  )
}
