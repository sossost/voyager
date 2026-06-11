/** 개발 모드에서 노출되는 상태 단언용 스토어 (src/store/index.ts). */
interface DevGameStore {
  getState(): {
    scene: { kind: string; starId?: string }
    currentStarId: string
    visitedStars: ReadonlySet<string>
    collectedIndividuals: ReadonlySet<string>
    storageMode: 'persistent' | 'memory'
    selectPlanet(planetId: string | null): void
    selectStar(starId: string | null): void
  }
}

interface Window {
  __gameStore?: DevGameStore
}
