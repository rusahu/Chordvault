import { render, screen } from '@testing-library/react';
import { DemoBanner } from '../DemoBanner';

vi.mock('../../context/DemoContext', () => ({ useDemo: () => ({ demoMode: true }) }));

it('shows the demo login', () => {
  render(<DemoBanner />);
  expect(screen.getByText('demo')).toBeInTheDocument();
  expect(screen.getByText('demopass123')).toBeInTheDocument();
});
