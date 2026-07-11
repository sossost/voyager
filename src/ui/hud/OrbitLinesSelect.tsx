import { useGameStore } from '@/store'

/**
 * 행성 궤도선(링·트레일) 표시 토글 (misc-ux) — 기본 표시, 설정에서 끌 수 있다.
 * SpeedSelect·QualitySelect와 같은 셀렉트 문법을 공유해 설정 팝오버의 위계가 일관된다.
 */
export function OrbitLinesSelect() {
  const isOrbitLinesVisible = useGameStore((state) => state.isOrbitLinesVisible)
  const setOrbitLinesVisible = useGameStore((state) => state.setOrbitLinesVisible)

  return (
    <label className="quality-select-label">
      <span className="visually-hidden">궤도선 표시</span>
      <select
        className="quality-select"
        value={isOrbitLinesVisible ? 'visible' : 'hidden'}
        onChange={(event) => setOrbitLinesVisible(event.target.value === 'visible')}
      >
        <option value="hidden">궤도선: 숨김</option>
        <option value="visible">궤도선: 표시</option>
      </select>
    </label>
  )
}
