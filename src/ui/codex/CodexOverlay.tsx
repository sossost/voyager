import { useMemo, useState } from 'react'

import {
  PHENOMENA_CATALOG,
  type PhenomenonArchetype,
  type PhenomenonKind,
} from '@/data/phenomena/phenomena'
import type { CollectionEntry } from '@/persistence/types'
import type { SpeciesArchetype } from '@/engine'
import { alienAt, SPECIES_BY_ID, SPECIES_CATALOG } from '@/engine'
import { useGameStore } from '@/store'
import { OverlayShell } from '@/ui/common/OverlayShell'
import { RARITY_LABELS } from '@/ui/common/rarityLabels'
import { AlienCard } from '@/ui/encounter/AlienCard'
import { archetypePreview } from '@/ui/codex/archetypePreview'

const PHENOMENON_RARITY_LABELS: Readonly<Record<PhenomenonArchetype['rarity'], string>> = {
  uncommon: '비범',
  rare: '희귀',
  legendary: '전설',
}

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

interface PhenomenonStat {
  readonly count: number
  readonly firstAt: number
}

function PhenomenonDetail({
  archetype,
  stat,
  onBack,
}: {
  readonly archetype: PhenomenonArchetype
  readonly stat: PhenomenonStat
  onBack(): void
}) {
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  )
  return (
    <section className="codex-detail" aria-label={`${archetype.label} 상세`}>
      <button type="button" className="hud-button" onClick={onBack}>
        ← 도감으로
      </button>
      <header className="codex-detail-header">
        <h3 className="codex-detail-title">{archetype.label}</h3>
        <span className="alien-card-rarity">{PHENOMENON_RARITY_LABELS[archetype.rarity]}</span>
      </header>
      <p className="codex-detail-lore">{archetype.lore}</p>
      <p className="codex-detail-subtitle">
        발견 {stat.count}회 · 최초 발견 {dateFormat.format(stat.firstAt)}
      </p>
    </section>
  )
}

function PhenomenaTab() {
  const discoveredPhenomena = useGameStore((state) => state.discoveredPhenomena)
  const [selectedKind, setSelectedKind] = useState<PhenomenonKind | null>(null)

  const byKind = useMemo(() => {
    const map = new Map<PhenomenonKind, PhenomenonStat>()
    for (const discovery of discoveredPhenomena) {
      if (discovery.kind === 'main_sequence') continue
      const prev = map.get(discovery.kind)
      map.set(discovery.kind, {
        count: (prev?.count ?? 0) + 1,
        firstAt: Math.min(prev?.firstAt ?? discovery.discoveredAt, discovery.discoveredAt),
      })
    }
    return map
  }, [discoveredPhenomena])

  const selectedArchetype =
    selectedKind == null ? null : PHENOMENA_CATALOG.find((a) => a.kind === selectedKind) ?? null
  const selectedStat = selectedKind == null ? null : byKind.get(selectedKind)
  if (selectedArchetype != null && selectedStat != null) {
    return (
      <PhenomenonDetail
        archetype={selectedArchetype}
        stat={selectedStat}
        onBack={() => setSelectedKind(null)}
      />
    )
  }

  const discoveredCount = byKind.size
  const completionPercent = Math.round((discoveredCount / PHENOMENA_CATALOG.length) * 100)

  return (
    <>
      <p className="codex-progress">
        발견한 현상 <strong>{discoveredCount}</strong> / {PHENOMENA_CATALOG.length} · 완성률{' '}
        <strong>{completionPercent}%</strong>
      </p>
      <ul className="codex-grid">
        {PHENOMENA_CATALOG.map((archetype) => {
          const stat = byKind.get(archetype.kind)
          const rarity = PHENOMENON_RARITY_LABELS[archetype.rarity]
          if (stat == null) {
            return (
              <li key={archetype.kind}>
                <div className="phenomenon-slot phenomenon-slot-locked" aria-label="미발견 현상">
                  <span className="phenomenon-slot-name">???</span>
                  <span className="phenomenon-slot-meta">{rarity} · 미발견</span>
                </div>
              </li>
            )
          }
          return (
            <li key={archetype.kind}>
              <button
                type="button"
                className="phenomenon-slot"
                onClick={() => setSelectedKind(archetype.kind)}
              >
                <span className="phenomenon-slot-name">{archetype.label}</span>
                <span className="phenomenon-slot-meta">
                  {rarity} · 발견 {stat.count}회
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

const CODEX_TABS = [
  { id: 'species', label: '외계생명체' },
  { id: 'phenomena', label: '현상' },
] as const

type CodexTabId = (typeof CODEX_TABS)[number]['id']

function CodexTabs({ active, onChange }: { readonly active: CodexTabId; onChange(id: CodexTabId): void }) {
  return (
    <div role="tablist" aria-label="도감 분류" className="codex-tabs">
      {CODEX_TABS.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`codex-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls="codex-tabpanel"
          tabIndex={active === tab.id ? 0 : -1}
          className="codex-tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const direction = event.key === 'ArrowRight' ? 1 : -1
            const nextIndex = (index + direction + CODEX_TABS.length) % CODEX_TABS.length
            const next = CODEX_TABS[nextIndex]
            if (next == null) return
            onChange(next.id)
            const sibling = event.currentTarget.parentElement?.children[nextIndex]
            if (sibling instanceof HTMLElement) sibling.focus()
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** 도감 (z-20 오버레이) — store 캐시만 읽는다, DB 조회 0회 (결정 19). 외계생명체·현상 탭 (결정 15). */
export function CodexOverlay() {
  const isOpen = useGameStore((state) => state.overlay === 'codex')
  const closeOverlay = useGameStore((state) => state.closeOverlay)
  const [activeTab, setActiveTab] = useState<CodexTabId>('species')

  if (!isOpen) return null

  return (
    <OverlayShell title="도감" onClose={closeOverlay}>
      <CodexTabs active={activeTab} onChange={setActiveTab} />
      <div role="tabpanel" id="codex-tabpanel" aria-labelledby={`codex-tab-${activeTab}`}>
        {activeTab === 'species' ? <CodexContent /> : <PhenomenaTab />}
      </div>
    </OverlayShell>
  )
}
