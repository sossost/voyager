/**
 * 시뮬레이션 배속 시계 — 궤도 운동(행성 공전·자전, 위성, 소행성대, 다중성계 중력 적분, 트레일)이
 * 참조하는 단일 시각 소스 (simulation-speed).
 *
 * 전역 THREE.Clock(state.clock.elapsedTime)에 배율을 걸면 워프 연출·카메라 담퍼가 같은 clock을
 * 쓰므로 오염된다. 그래서 별도 시각을 delta×timeScale로 누적한다 — SimClock 컴포넌트가 매 프레임
 * 전진시키고, 궤도 소비처는 elapsedTime 대신 이 값을 읽는다. 표면 셰이더·마커 펄스 등 앰비언트
 * 애니메이션은 그대로 elapsedTime을 써 실시간을 유지한다(배속 제외).
 *
 * 렌더 파생 — GEN_VERSION·저장·골든 무관.
 */
export const simClock = {
  /**
   * 배속이 반영된 누적 시뮬레이션 시각(초). 단조 증가하며 절대 리셋하지 않는다 —
   * closed-form 궤도(planetOrbitPosition 등)가 절대 시각을 각도로 쓰므로 리셋 시 위치가 튄다.
   */
  now: 0,
}
