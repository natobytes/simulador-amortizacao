import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Debounce `value` by `ms`. The returned setter bypasses the debounce for
 * programmatic updates (e.g. restoring persisted state) that must be visible
 * in the same commit. The pending timeout still fires, but setting the same
 * value again is a no-op re-render for React.
 */
export function useDebounced<T>(value: T, ms: number): [T, Dispatch<SetStateAction<T>>] {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return [debounced, setDebounced];
}
