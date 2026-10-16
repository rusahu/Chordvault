import type { ReactNode } from 'react';
import { SimpleGrid } from '@mantine/core';

export function StatGrid({ children }: { children: ReactNode }) {
  return <SimpleGrid cols={{ base: 1, md: 3 }} spacing={12} mb={28}>{children}</SimpleGrid>;
}
