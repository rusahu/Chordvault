import { useEffect } from 'react';
import { useElementSize } from '@mantine/hooks';

/** Publishes the element's height as a CSS variable on the page, so sticky things can stop below it. */
export function useHeightVar<T extends HTMLElement>(name: string) {
  const { ref, height } = useElementSize<T>();
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty(name, `${height}px`);
    return () => { root.removeProperty(name); };
  }, [name, height]);
  return ref;
}
