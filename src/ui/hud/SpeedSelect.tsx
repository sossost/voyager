import { useGameStore } from '@/store'
import type { TimeScale } from '@/store/types'

/**
 * 배속 옵션 (simulation-speed) — 0=일시정지, 1=정상. QualitySelect와 같은 셀렉트 문법을 공유해
 * 설정 팝오버 안에서 위계·스타일이 일관된다.
 */
const SPEED_OPTIONS: readonly { readonly value: TimeScale; readonly label: string }[] = [
  { value: 0, label: '일시정지' },
  { value: 1, label: '1× (정상)' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
  { value: 8, label: '8×' },
  { value: 16, label: '16×' },
]

/**
 * 시뮬레이션 배속 — 궤도 운동(공전·자전·위성·소행성대·다중성계 적분·트레일)의 시간 배율.
 * 표면 셰이더·마커 펄스 등 앰비언트 애니메이션은 실시간을 유지한다.
 */
export function SpeedSelect() {
  const timeScale = useGameStore((state) => state.timeScale)
  const setTimeScale = useGameStore((state) => state.setTimeScale)

  return (
    <label className="quality-select-label">
      <span className="visually-hidden">시뮬레이션 배속</span>
      <select
        className="quality-select"
        value={timeScale}
        onChange={(event) => setTimeScale(Number(event.target.value) as TimeScale)}
      >
        {SPEED_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {`속도: ${option.label}`}
          </option>
        ))}
      </select>
    </label>
  )
}
