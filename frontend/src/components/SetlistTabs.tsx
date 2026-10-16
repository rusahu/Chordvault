import { Tabs } from '@mantine/core';
import type { Navigate } from '../lib/routes';

export function SetlistTabs({ value, navigate }: { value: 'mine' | 'public'; navigate: Navigate }) {
  return (
    <Tabs variant="pills" value={value} onChange={(tab) => navigate(tab === 'public' ? 'public-setlists' : 'setlists')} className="setlist-tabs">
      <Tabs.List grow><Tabs.Tab value="mine">My Setlists</Tabs.Tab><Tabs.Tab value="public">Public Setlists</Tabs.Tab></Tabs.List>
    </Tabs>
  );
}
