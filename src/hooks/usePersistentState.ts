import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { loadStored, saveStored } from '../utils/storage';

interface Options<T> {
  // 저장값이 기대한 형태인지 검사한다. 통과하지 못하면 initial을 쓴다.
  validate?: (value: unknown) => value is T;
  // JSON으로 직렬화되며 잃은 타입(예: Date)을 복원한다. validate 이후에 적용한다.
  revive?: (raw: unknown) => T;
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  { validate, revive }: Options<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const raw = loadStored<unknown>(key, undefined);
    if (raw === undefined) return initial;
    if (validate && !validate(raw)) return initial;
    return revive ? revive(raw) : (raw as T);
  });

  useEffect(() => {
    saveStored(key, state);
  }, [key, state]);

  return [state, setState];
}
