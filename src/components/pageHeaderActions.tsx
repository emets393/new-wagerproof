import * as React from 'react';
import { createPortal } from 'react-dom';

const SLOT_ID = 'page-header-actions';

/** Empty slot beside the page title. Pages portal their buttons into it. */
export function PageHeaderActionsSlot() {
  return <div id={SLOT_ID} className="flex items-center" />;
}

/** Renders `actions` beside the page title. Updates on every render. */
export function usePageHeaderActions(actions: React.ReactNode) {
  const [slot, setSlot] = React.useState<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    setSlot(document.getElementById(SLOT_ID));
  }, []);
  return slot ? createPortal(actions, slot) : null;
}
