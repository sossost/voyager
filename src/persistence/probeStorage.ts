import { DexieDriver } from '@/persistence/dexieDriver'
import { MemoryDriver } from '@/persistence/memoryDriver'
import type { StorageDriver } from '@/persistence/types'

interface ProbeTarget {
  probe(): Promise<void>
}

/**
 * 저장소 프로브 — 'indexedDB' in window 같은 기능 감지가 아니라 실제 db.open()을
 * 시도한다 (Safari 사생활 모드는 API는 있고 open이 실패한다 — 결정 18).
 * 실패 시 MemoryDriver 폴백 + 호출자가 storageMode='memory' 경고 배너를 띄운다.
 */
export async function probeStorage(
  makePersistentDriver: () => StorageDriver & ProbeTarget = () => new DexieDriver(),
): Promise<StorageDriver> {
  try {
    const driver = makePersistentDriver()
    await driver.probe()
    return driver
  } catch {
    return new MemoryDriver()
  }
}
