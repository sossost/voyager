import { useMemo, useState } from 'react'

import type { CollectionEntry } from '@/persistence/types'
import type { SpeciesArchetype } from '@/engine'
import { alienAt, SPECIES_BY_ID, SPECIES_CATALOG } from '@/engine'
import { useGameStore } from '@/store'
import { OverlayShell } from '@/ui/common/OverlayShell'
import { RARITY_LABELS } from '@/ui/common/rarityLabels'
import { AlienCard } from '@/ui/encounter/AlienCard'
import { archetypePreview } from '@/ui/codex/archetypePreview'

interface SpeciesDetailProps {
  readonly species: SpeciesArchetype
  readonly entries: readonly CollectionEntry[]
  onBack(): void
}

function SpeciesDetail({ species, entries, onBack }: SpeciesDetailProps) {
  const seed = useGameStore((state) => state.seed)
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  )

  return (
    <section className="codex-detail" aria-label={`${species.name} 상세`}>
      <button type="button" className="hud-button" onClick={onBack}>
        ← 도감으로
      </button>

      <header className="codex-detail-header">
        <h3 className="codex-detail-title">{species.name}</h3>
        <span className={`alien-card-rarity rarity-text-${species.rarity}`}>
          {RARITY_LABELS[species.rarity]}
        </span>
      </header>
      <p className="codex-detail-lore">{species.lore}</p>

      <h4 className="codex-detail-subtitle">수집한 개체 ({entries.length})</h4>
      <ul className="codex-individual-list">
        {entries.map((entry) => {
          const individual = alienAt(seed, entry.planetId) // 결정론 — 기록에서 재생성
          return (
            <li key={entry.individualId} className="codex-individual">
              <AlienCard alien={individual} />
              <p className="codex-individual-meta">
                {dateFormat.format(entry.discoveredAt)}
                {entry.isFirstOfSpecies ? ' · ✨ 최초 발견' : ''}
                <br />
                좌표 {entry.planetId}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CodexContent() {
  const discoveredSpecies = useGameStore((state) => state.discoveredSpecies)
  const collectionEntries = useGameStore((state) => state.collectionEntries)
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null)

  const discoveredCount = discoveredSpecies.size
  const completionPercent = Math.round((discoveredCount / SPECIES_CATALOG.length) * 100)

  const selectedSpecies = selectedSpeciesId == null ? null : SPECIES_BY_ID.get(selectedSpeciesId)
  if (selectedSpecies != null) {
    return (
      <SpeciesDetail
        species={selectedSpecies}
        entries={collectionEntries.filter((entry) => entry.speciesId === selectedSpecies.id)}
        onBack={() => setSelectedSpeciesId(null)}
      />
    )
  }

  return (
    <>
      <p className="codex-progress">
        발견한 종족 <strong>{discoveredCount}</strong> / {SPECIES_CATALOG.length} ·{' '}
        도감 완성률 <strong>{completionPercent}%</strong>
      </p>
      <ul className="codex-grid">
        {SPECIES_CATALOG.map((species) => {
          const isDiscovered = discoveredSpecies.has(species.id)
          const firstEntry = isDiscovered
            ? collectionEntries.find((entry) => entry.speciesId === species.id)
            : undefined

          return (
            <li key={species.id}>
              {isDiscovered && firstEntry != null ? (
                <button
                  type="button"
                  className="codex-slot"
                  onClick={() => setSelectedSpeciesId(species.id)}
                >
                  <DiscoveredSlot planetId={firstEntry.planetId} />
                </button>
              ) : (
                <div className="codex-slot codex-slot-unknown" aria-label="미발견 종족">
                  <AlienCard alien={archetypePreview(species)} silhouette />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function DiscoveredSlot({ planetId }: { readonly planetId: CollectionEntry['planetId'] }) {
  const seed = useGameStore((state) => state.seed)
  const representative = useMemo(() => alienAt(seed, planetId), [seed, planetId])
  return <AlienCard alien={representative} />
}

/** 도감 (z-20 오버레이) — store 캐시만 읽는다, DB 조회 0회 (결정 19). */
export function CodexOverlay() {
  const isOpen = useGameStore((state) => state.overlay === 'codex')
  const closeOverlay = useGameStore((state) => state.closeOverlay)

  if (!isOpen) return null

  return (
    <OverlayShell title="외계생명체 도감" onClose={closeOverlay}>
      <CodexContent />
    </OverlayShell>
  )
}
