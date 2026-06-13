import { Analytics } from '@vercel/analytics/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { BootGate } from '@/ui/boot/BootGate'

import '@/styles/global.css'

// Ctrl+휠·Ctrl+±·Ctrl+0 브라우저 줌 차단 — 게임 캔버스 좌표계가 깨진다
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
    e.preventDefault()
  }
})

const rootElement = document.getElementById('root')
if (rootElement == null) {
  throw new Error('루트 엘리먼트(#root)를 찾을 수 없습니다.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BootGate />
    <Analytics />
  </StrictMode>,
)
