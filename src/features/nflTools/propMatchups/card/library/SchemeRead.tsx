import type { ReactNode } from 'react';

export function SchemeRead({
  kicker,
  sentence,
  children,
}: {
  kicker: ReactNode;
  sentence: string;
  children: ReactNode;
}) {
  return (
    <div className="ctx t2strip">
      <div className="ctx-h">{kicker}</div>
      <p className="say">{sentence}</p>
      <p className="ctx-n">{children}</p>
    </div>
  );
}
