export function createHistory(limit = 100) {
  return { past: [], present: null, future: [], limit };
}

export function push(history, nextPresent) {
  const { past, present, limit } = history;
  const nextPast = present ? [...past, present] : [...past];
  if (nextPast.length > limit) nextPast.shift();
  return { ...history, past: nextPast, present: nextPresent, future: [] };
}

export function canUndo(history) { return history.past.length > 0; }
export function canRedo(history) { return history.future.length > 0; }

export function undo(history) {
  if (!canUndo(history)) return history;
  const prev = history.past[history.past.length - 1];
  const nextPast = history.past.slice(0, -1);
  const nextFuture = history.present ? [history.present, ...history.future] : [...history.future];
  return { ...history, past: nextPast, present: prev, future: nextFuture };
}

export function redo(history) {
  if (!canRedo(history)) return history;
  const next = history.future[0];
  const nextFuture = history.future.slice(1);
  const nextPast = history.present ? [...history.past, history.present] : [...history.past];
  return { ...history, past: nextPast, present: next, future: nextFuture };
}
