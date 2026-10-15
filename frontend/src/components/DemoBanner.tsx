import { Alert } from '@mantine/core';
import { useDemo } from '../context/DemoContext';
import { DEMO_ACCOUNT } from '../lib/constants';

export function DemoBanner() {
  const { demoMode } = useDemo();
  if (!demoMode) return null;

  return (
    <Alert className="demo-banner">
      Demo instance &middot; Login: <strong>{DEMO_ACCOUNT.username}</strong> / <strong>{DEMO_ACCOUNT.password}</strong> &middot; Data resets every 6 hours
    </Alert>
  );
}
