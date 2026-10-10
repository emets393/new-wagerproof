import type { ReactNode } from 'react';
import type { DuelTone } from './DuelRow';

export function PropCard({
  tier = 't3',
  title,
  meta,
  className,
  children,
}: {
  tier?: 't2' | 't3' | '';
  title?: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={['card', tier, className].filter(Boolean).join(' ')}>
      {title ? (
        <h3>
          <span className="ht">{title}</span>
          {meta ? <span>{meta}</span> : null}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function CardHero({
  value,
  tone,
  children,
}: {
  value?: string;
  tone?: DuelTone;
  children?: ReactNode;
}) {
  return (
    <div className="cardhero">
      {value ? <div className={tone ? `ch-v ${tone}` : 'ch-v'}>{value}</div> : null}
      {children ? <div className="ch-c">{children}</div> : null}
    </div>
  );
}

export function StatTiles({
  tiles,
}: {
  tiles: { label: string; value: string; unit?: string }[];
}) {
  return (
    <dl className="grid3">
      {tiles.map((tile) => (
        <div className="stat" key={tile.label}>
          <dt>{tile.label}</dt>
          <dd>
            {tile.value}
            {tile.unit ? <s>{tile.unit}</s> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
