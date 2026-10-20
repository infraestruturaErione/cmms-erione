import { useEffect, useRef, useState } from 'react';
import { Task } from '../models/tasks';
import type { SaveFeedback } from './useSaveFeedback';

type Field = 'value' | 'notes';
type Value = string | number;
export default function useTaskEdits(
  saveTask: (id: number, field: Field, value: Value) => Promise<unknown>,
  canEdit: boolean,
  confirmedTasks: Task[] = []
) {
  const drafts = useRef<Record<string, Value>>({});
  const revisions = useRef<Record<string, number>>({});
  const confirmed = useRef<Record<string, Value>>({});
  const baseline = useRef<Record<string, Value>>({});
  confirmedTasks.forEach((task) => {
    (['value', 'notes'] as const).forEach((field) => {
      const key = `${task.id}:${field}`;
      const value = task[field] ?? '';
      if (!(key in baseline.current) || baseline.current[key] !== value) {
        confirmed.current[key] = value;
        baseline.current[key] = value;
      }
    });
  });
  const flights = useRef(
    new Map<string, { revision: number; promise: Promise<boolean> }>()
  );
  const active = useRef(true);
  const editable = useRef(canEdit);
  editable.current = canEdit;
  const saveRef = useRef(saveTask);
  saveRef.current = saveTask;
  const [states, setStates] = useState<Record<string, SaveFeedback>>({});
  const [, renderNotes] = useState(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const set = (key: string, state: SaveFeedback) => {
    if (active.current)
      setStates((old) => (old[key] === state ? old : { ...old, [key]: state }));
  };
  const edit = (id: number, field: Field, value: Value) => {
    if (!editable.current || !active.current) return;
    const key = `${id}:${field}`;
    if (drafts.current[key] === value) return;
    if (
      !(key in drafts.current) &&
      key in confirmed.current &&
      String(confirmed.current[key]) === String(value)
    )
      return;
    drafts.current[key] = value;
    revisions.current[key] = (revisions.current[key] ?? 0) + 1;
    set(key, 'waiting');
    if (field === 'notes') renderNotes((version) => version + 1);
  };
  const save = (id: number, field: Field): Promise<boolean> => {
    if (!editable.current || !active.current) return Promise.resolve(false);
    const key = `${id}:${field}`;
    if (!(key in drafts.current)) return Promise.resolve(true);
    const revision = revisions.current[key];
    const pending = flights.current.get(key);
    if (pending?.revision === revision) return pending.promise;
    const value = drafts.current[key];
    set(key, 'saving');
    const clear = () => {
      if (flights.current.get(key)?.revision === revision)
        flights.current.delete(key);
    };
    const promise = Promise.resolve()
      .then(() => {
        if (!active.current || !editable.current)
          throw new Error('O envio não foi iniciado. Confira o acesso à OS.');
        return saveRef.current(id, field, value);
      })
      .then(
        () => {
          const current = active.current && revisions.current[key] === revision;
          if (current) {
            delete drafts.current[key];
            confirmed.current[key] = value;
          }
          // Remove the completed request before publishing success to navigation.
          clear();
          if (current) {
            set(key, 'saved');
          }
          return current;
        },
        (error) => {
          clear();
          if (revisions.current[key] === revision) set(key, 'error');
          throw error;
        }
      );
    flights.current.set(key, { revision, promise });
    return promise;
  };
  const hasPendingNow = () =>
    Object.keys(drafts.current).length > 0 || flights.current.size > 0;
  const savePending = async () => {
    const results = await Promise.allSettled(
      Object.keys(drafts.current).map((key) => {
        const [id, field] = key.split(':');
        return save(Number(id), field as Field);
      })
    );
    return (
      results.every(
        (result) => result.status === 'fulfilled' && result.value
      ) && !hasPendingNow()
    );
  };
  return {
    states,
    edit,
    save,
    savePending,
    hasPending: hasPendingNow(),
    isBusy: () => flights.current.size > 0,
    leave: () => {
      active.current = false;
    },
    overlay: (task: Task): Task => ({
      ...task,
      ...(`${task.id}:value` in drafts.current
        ? { value: drafts.current[`${task.id}:value`] }
        : {}),
      ...(`${task.id}:notes` in drafts.current
        ? { notes: String(drafts.current[`${task.id}:notes`]) }
        : {})
    })
  };
}
