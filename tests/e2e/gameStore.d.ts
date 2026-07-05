/** 개발 모드에서 노출되는 상태 단언용 스토어 (src/store/index.ts). */
interface DevGameStore {
  getState(): {
    scene: { kind: string; view?: 'ship' | 'perspective' }
    seed: string
    currentStarId: string
    isGuestMode: boolean
    visitedStars: ReadonlySet<string>
    collectedIndividuals: ReadonlySet<string>
    scannedStars: ReadonlySet<string>
    storageMode: 'persistent' | 'memory'
    timeScale: 0 | 1 | 2 | 4 | 8 | 16
    selectPlanet(planetId: string | null): void
    selectStar(starId: string | null): void
    warpTo(target: string): void
    scanSurroundings(): void
    setTimeScale(scale: 0 | 1 | 2 | 4 | 8 | 16): void
  }
}

interface Window {
  __gameStore?: DevGameStore
}
