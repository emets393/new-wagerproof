import * as React from 'react';
import { Map, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OutliersQuickNavItem { id: string; label: string }

export function OutliersQuickNav({ items }: { items: OutliersQuickNavItem[] }) {
  const [activeId, setActiveId] = React.useState(items[0]?.id ?? '');

  React.useEffect(() => {
    const elements = items.map((item) => document.getElementById(item.id)).filter((element): element is HTMLElement => Boolean(element));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveId(visible[0].target.id);
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.1] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items]);

  const jumpTo = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] self-start overflow-y-auto rounded-[22px] border border-border/60 bg-background/65 p-3 shadow-sm backdrop-blur-xl lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Today's Outliers sections">
      <div className="flex items-center gap-2 px-2 pb-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary"><Map className="h-4 w-4" /></span>
        <div><p className="text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">On this page</p><p className="text-xs font-bold text-foreground">Quick reference</p></div>
      </div>
      <nav className="relative border-l border-border/70 pl-2">
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <button key={item.id} type="button" onClick={() => jumpTo(item.id)} aria-current={active ? 'location' : undefined} className={cn('group relative flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold transition-colors', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/55 hover:text-foreground')}>
              <span className={cn('absolute -left-[13px] h-2 w-2 rounded-full border-2 border-background transition-all', active ? 'scale-125 bg-primary' : 'bg-border group-hover:bg-muted-foreground')} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {active && <Navigation className="h-3 w-3 shrink-0" fill="currentColor" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
