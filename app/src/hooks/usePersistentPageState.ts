import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function usePersistentPageState(
  key: string,
  initialValue = '',
): [string, Dispatch<SetStateAction<string>>] {
  const [value, setValue] = useState(() => {
    try {
      return window.sessionStorage.getItem(`parts-connect:${key}`) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`parts-connect:${key}`, value);
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [key, value]);

  return [value, setValue];
}
