import { Paper, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export function SettingsSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
    <Title order={3} fz={16} mb={4}>{title}</Title>
    {children}
  </Paper>;
}
