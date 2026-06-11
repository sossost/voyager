export function WebGLBlocked() {
  return (
    <main className="webgl-blocked" role="alert">
      <h1>Stellar Voyage</h1>
      <p>이 게임은 3D 그래픽(WebGL)을 사용할 수 있는 환경이 필요합니다.</p>
      <p className="webgl-blocked-hint">
        최신 버전의 Chrome, Edge, Firefox, Safari에서 다시 시도해 주세요.
        브라우저 설정에서 하드웨어 가속이 꺼져 있다면 켠 뒤 새로고침해 주세요.
      </p>
    </main>
  )
}
