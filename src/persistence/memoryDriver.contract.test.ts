import { describeStorageDriverContract } from '@/persistence/driverContract'
import { MemoryDriver } from '@/persistence/memoryDriver'

describeStorageDriverContract('MemoryDriver', () => new MemoryDriver())
