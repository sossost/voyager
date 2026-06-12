import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { BootGate } from '@/ui/boot/BootGate'

import '@/styles/global.css'

const rootElement = document.getElementById('root')
if (rootElement == null) {
  throw new Error('루트 엘리먼트(#root)를 찾을 수 없습니다.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BootGate />
  </StrictMode>,
)
