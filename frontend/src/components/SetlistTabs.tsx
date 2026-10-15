import { Tabs } from '@mantine/core';

export function SetlistTabs({ value, navigate }: { value: 'mine' | 'public'; navigate: (view: string) => void }) {
  return (
    <Tabs variant="pills" value={value} onChange={(tab) => navigate(tab === 'public' ? 'public-setlists' : 'setlists')} className="setlist-tabs">
      <Tabs.List grow><Tabs.Tab value="mine">My Setlists</Tabs.Tab><Tabs.Tab value="public">Public Setlists</Tabs.Tab></Tabs.List>
    </Tabs>
  );
}
