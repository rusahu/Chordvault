import { SegmentedControl } from '@mantine/core';
import type { Navigate } from '../lib/routes';

const data = [{ value: 'mine', label: 'My Setlists' }, { value: 'public', label: 'Public Setlists' }];
const styles = {
  indicator: { background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(29, 27, 25, 0.12)' },
  label: { fontWeight: 500, fontSize: 'var(--mantine-font-size-sm)' },
};

export function SetlistTabs({ value, navigate }: { value: 'mine' | 'public'; navigate: Navigate }) {
  return (
    <SegmentedControl fullWidth size="lg" mb={16} radius={12} withItemsBorders={false} bg="var(--ctrl)" bd="1px solid var(--border)" styles={styles}
      aria-label="Setlists" data={data} value={value} onChange={(tab) => navigate(tab === 'public' ? 'public-setlists' : 'setlists')} />
  );
}
