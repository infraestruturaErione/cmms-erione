import { useRef } from 'react';

export default function usePageRequestGate() {
  const pending = useRef(false);
  return (allowed: boolean, load: () => Promise<unknown>) => {
    if (!allowed || pending.current) return;
    pending.current = true;
    return Promise.resolve()
      .then(load)
      .finally(() => {
        pending.current = false;
      });
  };
}
