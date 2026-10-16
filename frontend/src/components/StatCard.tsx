import type { ReactNode } from 'react';
import { Paper, Text } from '@mantine/core';

export function StatCard({ value, label }: { value: number; label: ReactNode }) {
  return (
    <Paper withBorder bg="var(--ui-card-bg)" radius="var(--radius)" py={22} px={20} ta="center" shadow="sm">
      <Text fz={36} fw={700} c="var(--accent)" lh={1.2}>{value}</Text>
      <Text fz={13} c="dimmed" mt={4}>{label}</Text>
    </Paper>
  );
}
