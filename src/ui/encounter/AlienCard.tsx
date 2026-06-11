import type { CSSProperties } from 'react'

import type { AlienIndividual } from '@/engine'
import { PART_COMPONENTS, PART_SLOT_Z_ORDER } from '@/assets/parts/partsManifest'
import { RARITY_LABELS } from '@/ui/common/rarityLabels'

interface AlienCardProps {
  readonly alien: AlienIndividual
  /** 도감 미발견 슬롯용 — CSS filter 한 줄로 실루엣 처리 (결정 17). */
  readonly silhouette?: boolean
}

/**
 * 외계인 카드 — 파츠 SVG를 z순서로 합성하고 CSS 변수로 개체 팔레트를 입힌다.
 * 순수 렌더(개체 → SVG)라 스냅샷 테스트 가능.
 */
export function AlienCard({ alien, silhouette = false }: AlienCardProps) {
  const paletteStyle = {
    '--alien-primary': alien.palette.primary,
    '--alien-secondary': alien.palette.secondary,
    '--alien-accent': alien.palette.accent,
  } as CSSProperties

  const cardClassName = [
    'alien-card',
    `alien-card-${alien.rarity}`,
    silhouette ? 'alien-card-silhouette' : '',
  ]
    .filter((name) => name !== '')
    .join(' ')

  return (
    <figure className={cardClassName} style={paletteStyle}>
      <div className="alien-card-stage" aria-hidden="true">
        {PART_SLOT_Z_ORDER.map((slot) => {
          const partId = alien.parts[slot]
          const Part = PART_COMPONENTS[partId]
          if (Part == null) return null
          return <Part key={slot} className="alien-part" />
        })}
      </div>
      <figcaption className="alien-card-caption">
        <span className="alien-card-name">{silhouette ? '???' : alien.name}</span>
        <span className={`alien-card-rarity rarity-text-${alien.rarity}`}>
          {RARITY_LABELS[alien.rarity]}
        </span>
      </figcaption>
    </figure>
  )
}
