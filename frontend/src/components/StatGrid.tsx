import type { ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { SimpleGrid } from '@mantine/core';

export function StatGrid({ children }: { children: ReactNode }) {
  const wide = useMediaQuery('(min-width: 900px)', undefined, { getInitialValueInEffect: false });
  return <SimpleGrid cols={wide ? 3 : 1} spacing={12} mb={28}>{children}</SimpleGrid>;
}
