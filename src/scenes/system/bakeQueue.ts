/**
 * 프레임 분산 베이크 큐 — 프레임당 1개 작업만 실행한다 (결정 33).
 *
 * 별계 진입 시 행성 1~8장의 텍스처 베이크(고티어 장당 ~36ms)를 한 프레임에
 * 동기로 몰면 진입 히치가 생긴다. 큐는 rAF 체인으로 한 프레임에 한 장씩
 * 베이크해 어떤 해상도에서도 프레임 드랍 없이 텍스처가 순차 팝인되게 한다.
 */

type BakeTask = () => void

const pendingTasks: BakeTask[] = []
let isPumping = false

function pump(): void {
  const task = pendingTasks.shift()
  if (task == null) {
    isPumping = false
    return
  }
  task()
  requestAnimationFrame(pump)
}

/**
 * 작업을 큐에 넣는다. 반환된 함수를 호출하면 아직 실행 전인 작업을 취소한다
 * (이펙트 클린업용 — StrictMode 이중 실행에도 안전).
 */
export function enqueueBake(task: BakeTask): () => void {
  pendingTasks.push(task)
  if (isPumping === false) {
    isPumping = true
    requestAnimationFrame(pump)
  }
  return () => {
    const index = pendingTasks.indexOf(task)
    if (index >= 0) pendingTasks.splice(index, 1)
  }
}
