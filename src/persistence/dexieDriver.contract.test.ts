import 'fake-indexeddb/auto'

import { describeStorageDriverContract } from '@/persistence/driverContract'
import { DexieDriver } from '@/persistence/dexieDriver'

// MemoryDriver와 동일한 계약 스위트 — 폴백 동등성의 증명 (결정 19)
describeStorageDriverContract('DexieDriver (fake-indexeddb)', () => new DexieDriver())
