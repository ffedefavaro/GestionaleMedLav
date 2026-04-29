import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';

export function useAutosave<T>(key: string, initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    get(key).then(saved => {
      if (saved) setData(saved);
      setIsLoaded(true);
    });
  }, [key]);

  useEffect(() => {
    if (isLoaded) {
      set(key, data);
    }
  }, [key, data, isLoaded]);

  return [data, setData, isLoaded] as const;
}
