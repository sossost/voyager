import { AccretionDisk } from '@/scenes/system/AccretionDisk'

/**
 * 블랙홀 — 페이크 적층(결정 5): 깨끗한 검은 사건지평선 구(결정 31 — 감싸는 막 없음) +
 * 그를 두르는 밝은 비대칭 강착원반(도플러 + 안쪽 포톤 링, AccretionDisk).
 *
 * 풀스크린 중력렌즈 없이도 도플러 비대칭 고리로 "블랙홀"로 또렷이 읽힌다. 포스트프로세싱 0
 * — 모바일 안전. 진짜 렌즈는 high 티어 후순위(비범위). 사건지평선은 크게 두어 high 티어
 * Bloom 번짐이 검은 코어를 흰색으로 메우지 않도록 한다(작은 코어 + 밝은 고리 = 흰 중심 버그).
 */

const SPHERE_SEGMENTS = 48

interface BlackHoleProps {
  /** 사건지평선 반경 (= STAR_VISUAL_RADIUS × kindRadiusFactor('black_hole')). */
  readonly radius: number
}

export function BlackHole({ radius }: BlackHoleProps) {
  return (
    <>
      {/* 사건지평선 — 깨끗한 불투명 검은 구. renderOrder=-1로 디스크보다 먼저 그려 깊이를
          써서 디스크 far side를 가린다(렌즈 없는 룩). */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <AccretionDisk radius={radius} />
    </>
  )
}
