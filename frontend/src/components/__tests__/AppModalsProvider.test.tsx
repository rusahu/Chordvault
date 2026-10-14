import { fireEvent, render, screen } from '@testing-library/react';
import { useModals } from '@mantine/modals';
import { AppModalsProvider } from '../AppModalsProvider';

const { locale } = vi.hoisted(() => ({ locale: {} as Record<string, string> }));
vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string, fallback?: string) => locale[key] || fallback || key }),
}));
afterEach(() => { for (const key of Object.keys(locale)) delete locale[key]; });

function Opener() {
  const modals = useModals();
  return <button onClick={() => modals.openConfirmModal({ children: 'Sure?' })}>Open</button>;
}

it('gives confirm dialogs translated default labels', async () => {
  Object.assign(locale, { 'common.confirm': 'Konfirmasi', 'common.cancel': 'Batal' });
  render(<AppModalsProvider><Opener /></AppModalsProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(await screen.findByRole('button', { name: 'Konfirmasi' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
});

it('falls back to English labels before translations load', async () => {
  render(<AppModalsProvider><Opener /></AppModalsProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(await screen.findByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
});
