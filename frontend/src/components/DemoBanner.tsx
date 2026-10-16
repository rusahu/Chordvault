import { Alert } from '@mantine/core';
import { useDemo } from '../context/DemoContext';
import { DEMO_ACCOUNT } from '../lib/constants';

export function DemoBanner() {
  const { demoMode } = useDemo();
  if (!demoMode) return null;

  return (
    <Alert bg="var(--surface2)" c="var(--text)" ta="center" py={6} px={16} fz={13} lh={1.4}>
      Demo instance &middot; Login: <strong>{DEMO_ACCOUNT.username}</strong> / <strong>{DEMO_ACCOUNT.password}</strong> &middot; Data resets every 6 hours
    </Alert>
  );
}
