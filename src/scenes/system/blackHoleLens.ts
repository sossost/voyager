import { Matrix4, Vector2, Vector3 } from 'three'

/**
 * 블랙홀 렌더 ↔ 포스트 패스 공유 상태.
 *
 * CurrentSystem이 매 프레임 현재 별이 블랙홀일 때 카메라 행렬·BH 파라미터를 게시하고,
 * BlackHoleRayMarchEffect(측지선 레이마칭)가 update()에서 읽어 유니폼에 넣는다.
 * 연속 값은 모듈 상태 + useFrame만 (철칙 6 — store 금지). high 티어 전용 + LOD/화면 게이팅이라
 * 평소(비활성·BH 영역 밖)엔 거의 무비용.
 */
export const blackHoleLens = {
  /** 렌즈 활성 — 현재 별이 블랙홀이고 근접(LOD 안)일 때만 true. */
  active: false,
  /** 카메라 월드 좌표. */
  cameraPos: new Vector3(),
  /** 화면 UV → 월드 광선 복원용 (matrixWorld · projectionMatrixInverse). */
  invViewProj: new Matrix4(),
  /** 탈출 광선 방향 → 화면 UV 투영용 (projectionMatrix · matrixWorldInverse). */
  viewProj: new Matrix4(),
  /** 사건지평선 월드 좌표(= 별 월드 좌표). */
  bhPos: new Vector3(),
  /** 슈바르츠실트 반경(월드) — 사건지평선 시각 반경. */
  rs: 1,
  /** 강착원반 안/바깥 반경(월드). */
  diskInner: 2.5,
  diskOuter: 9,
  /**
   * 강착원반 유무 (exotic-codex) — 절차 블랙홀은 고립·암흑(먹일 물질 없음)이라 false,
   * 유니크계(아케론·카리브디스)만 true. false면 레이마칭이 렌즈·그림자만 그린다.
   */
  diskEnabled: false,
  /**
   * 로슈엽 물질 스트림 (카리브디스 전용) — 씬 공간 파티클은 레이마칭 전담 영역에 덮여
   * 사라지므로 스트림도 레이마칭이 원반과 같은 방식으로 그린다 (렌즈 왜곡 정합 보너스).
   */
  streamEnabled: false,
  /** 반성 방향 월드 각(atan2(z,x)) — 스트림 나선의 시작 각. */
  streamAngle: 0,
  /** 스트림 시작 반경(월드) — 반성 표면 근방. */
  streamStartR: 20,
  /** 강착원반 평면 법선(월드, 정규화) — 수평 원반이면 (0,1,0). */
  diskNormal: new Vector3(0, 1, 0),
  /** 사건지평선 화면 중심(UV) — 게이팅용. */
  center: new Vector2(0.5, 0.5),
  /** BH 영향권 화면 반경(세로 UV) — 이 밖은 패스스루(성능). */
  screenRadius: 0.2,
}

export function clearBlackHoleLens(): void {
  blackHoleLens.active = false
}
