import { useCallback, useState } from "react";

export function useToggleSet<T = string>(initial?: Iterable<T>) {
  const [set, setSet] = useState<Set<T>>(() => new Set(initial));

  const toggle = useCallback((item: T) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }, []);

  const add = useCallback((item: T) => {
    setSet((prev) => {
      const next = new Set(prev);
      next.add(item);
      return next;
    });
  }, []);

  const replaceAll = useCallback((items: Iterable<T>) => {
    setSet(new Set(items));
  }, []);

  const clear = useCallback(() => {
    setSet(new Set());
  }, []);

  return { set, toggle, add, replaceAll, clear };
}
