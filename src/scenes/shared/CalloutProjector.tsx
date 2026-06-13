import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

/**
 * 홀로그램 콜아웃 투영기 (결정 37, 백로그 G-a-5에서 별/행성 공용으로 일반화) —
 * 대상의 월드 좌표를 매 프레임 화면 좌표로 투영해 DOM 콜아웃(selector)의
 * transform에 직접 쓴다. drei Html 금지 규칙(DOM 레이어 분리)을 지키면서
 * 패널이 천체에 "붙는" 방법: React 상태를 거치지 않으므로(철칙 6) 프레임당
 * 리렌더가 없다. 공전하는 행성도 computeWorldPosition이 시간 기반으로
 * 궤도 위치를 재계산해 따라간다.
 */

/** 화면 가장자리 여백 — 콜아웃 앵커(점)가 이 안쪽으로 클램프된다. */
const EDGE_MARGIN_PX = 14
/** 앵커가 오른쪽으로 이만큼 가까우면 패널을 왼쪽으로 편다 (패널 폭 + 리더 라인). */
const FLIP_X_THRESHOLD_PX = 420
/** 앵커가 위로 이만큼 가까우면 패널을 아래로 편다 (패널 높이 + 리더 라인). */
const FLIP_Y_THRESHOLD_PX = 330
/** 이하 폭에서 패널을 데크 위 슬롯에 도킹한다 (결정 42-f) — CSS 미디어쿼리와 동일 값. */
const DOCK_MAX_WIDTH_PX = 540
/** 리더 라인의 CSS 기본 길이 — 도킹 모드에서 scaleX의 분모. */
const LINE_BASE_LENGTH_PX = 90
/** 도킹 패널에서 리더 라인이 닿는 지점 — 좌상단 모서리에서의 안쪽 오프셋. */
const DOCK_LINE_ANCHOR_INSET_PX = 18

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

interface CalloutProjectorProps {
  /** 콜아웃 DOM을 찾는 셀렉터 — 예: '[data-star-callout]'. */
  readonly selector: string
  /**
   * 선택 식별자 — 바뀌면 콜아웃 DOM이 리마운트됐을 수 있어 다시 찾는다.
   * null이면 선택 없음 (DOM도 없다).
   */
  readonly targetKey: string | null
  /**
   * 대상의 현재 월드 좌표를 out에 쓴다. false를 반환하면 대상 없음 — 숨긴다.
   * 공전 천체는 elapsedSeconds로 궤도 위치를 재계산한다 (렌더 수식과 단일 소스).
   */
  computeWorldPosition(out: Vector3, elapsedSeconds: number): boolean
}

export function CalloutProjector({
  selector,
  targetKey,
  computeWorldPosition,
}: CalloutProjectorProps) {
  const elementRef = useRef<HTMLElement | null>(null)
  const wasDockedRef = useRef(false)
  const worldScratch = useMemo(() => new Vector3(), [])
  const forwardScratch = useMemo(() => new Vector3(), [])

  // 콜아웃 DOM은 선택이 생길 때 마운트된다 — 선택 변화에 맞춰 다시 찾는다
  useEffect(() => {
    elementRef.current = document.querySelector<HTMLElement>(selector)
    return () => {
      elementRef.current = null
    }
  }, [selector, targetKey])

  useFrame((state) => {
    if (!computeWorldPosition(worldScratch, state.clock.elapsedTime)) return
    const element =
      elementRef.current ??
      (elementRef.current = document.querySelector<HTMLElement>(selector))
    if (element == null) return

    // 카메라 뒤의 대상은 투영 좌표가 뒤집힌다 — 숨김 처리
    state.camera.getWorldDirection(forwardScratch)
    const toTargetDot =
      (worldScratch.x - state.camera.position.x) * forwardScratch.x +
      (worldScratch.y - state.camera.position.y) * forwardScratch.y +
      (worldScratch.z - state.camera.position.z) * forwardScratch.z
    if (toTargetDot <= 0) {
      element.style.visibility = 'hidden'
      return
    }

    worldScratch.project(state.camera)
    const x = clamp(
      (worldScratch.x * 0.5 + 0.5) * state.size.width,
      EDGE_MARGIN_PX,
      state.size.width - EDGE_MARGIN_PX,
    )
    const y = clamp(
      (-worldScratch.y * 0.5 + 0.5) * state.size.height,
      EDGE_MARGIN_PX,
      state.size.height - EDGE_MARGIN_PX,
    )

    element.style.visibility = 'visible'

    // 도킹 모드 (결정 42-f) — 패널은 데크 위 고정 슬롯(CSS), 점·리더라인만 천체를 따라간다.
    // 루트 transform을 비워야 패널의 position:fixed가 뷰포트 기준으로 풀린다.
    const isDocked = state.size.width <= DOCK_MAX_WIDTH_PX
    if (isDocked !== wasDockedRef.current) {
      wasDockedRef.current = isDocked
      element.classList.toggle('callout-docked', isDocked)
      if (isDocked === false) {
        clearInlineTransform(element, '.callout-dot')
        clearInlineTransform(element, '.callout-line')
      }
    }

    if (isDocked) {
      element.style.transform = ''
      element.classList.remove('callout-flip-x', 'callout-flip-y')

      const dot = element.querySelector<HTMLElement>('.callout-dot')
      const line = element.querySelector<HTMLElement>('.callout-line')
      const panel = element.querySelector<HTMLElement>('.hud-panel')
      if (dot != null) {
        dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      }
      if (line != null && panel != null) {
        // 패널은 고정 슬롯이라 rect가 안정적 — transform 쓰기만 하므로 레이아웃 무효화 없음
        const rect = panel.getBoundingClientRect()
        const dx = rect.left + DOCK_LINE_ANCHOR_INSET_PX - x
        const dy = rect.top - y
        const length = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx)
        line.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad) scaleX(${length / LINE_BASE_LENGTH_PX})`
      }
      return
    }

    element.style.transform = `translate(${x}px, ${y}px)`
    element.classList.toggle('callout-flip-x', x > state.size.width - FLIP_X_THRESHOLD_PX)
    element.classList.toggle('callout-flip-y', y < FLIP_Y_THRESHOLD_PX)
  })

  return null
}

function clearInlineTransform(root: HTMLElement, childSelector: string): void {
  const child = root.querySelector<HTMLElement>(childSelector)
  if (child != null) child.style.transform = ''
}
