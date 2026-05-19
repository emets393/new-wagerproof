import { useEffect, useState } from 'react';

const TOUCH_MEDIA = '(hover: none), (pointer: coarse)';

/** True on phones/tablets where hover tooltips do not work reliably. */
export function useTouchPointer(): boolean {
  const [touch, setTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(TOUCH_MEDIA).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(TOUCH_MEDIA);
    const update = () => setTouch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return touch;
}
