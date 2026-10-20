import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveFeedback = 'waiting' | 'saving' | 'saved' | 'error';

// UI acknowledgements only. No offline queue, persistence or automatic retry.
export default function useSaveFeedback() {
  const revisions = useRef<Record<string, number>>({});
  const mounted = useRef(true);
  const [states, setStates] = useState<Record<string, SaveFeedback>>({});
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const set = useCallback((key: string, state: SaveFeedback) => {
    if (mounted.current)
      setStates((current) =>
        current[key] === state ? current : { ...current, [key]: state }
      );
  }, []);
  const markEdited = useCallback(
    (key: string) => {
      revisions.current[key] = (revisions.current[key] ?? 0) + 1;
      set(key, 'waiting');
    },
    [set]
  );
  const trackSave = useCallback(
    async (key: string, save: () => Promise<unknown>) => {
      const revision = (revisions.current[key] ?? 0) + 1;
      revisions.current[key] = revision;
      set(key, 'saving');
      try {
        await save();
        const current = revisions.current[key] === revision;
        if (current) set(key, 'saved');
        return current;
      } catch (error) {
        if (revisions.current[key] === revision) set(key, 'error');
        throw error;
      }
    },
    [set]
  );
  return { states, markEdited, trackSave };
}
