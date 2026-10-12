import { fireEvent, render, screen } from '@testing-library/react';
import { OfflineLibrarySettings } from '../OfflineLibrarySettings';
import { useOffline } from '../../context/OfflineContext';

vi.mock('../../context/OfflineContext', () => ({ useOffline: vi.fn() }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (_key: string, fallback: string) => fallback }) }));

const WARNING = 'Your browser may clear offline songs when storage is low. Adding ChordVault to your home screen helps keep them.';
const requestPersistence = vi.fn();
const base = {
  state: undefined, busy: false, error: '', shellError: '', shellReady: true, online: true,
  enable: vi.fn(), disable: vi.fn(), refresh: vi.fn(), requestPersistence,
};
const renderWith = (overrides: Record<string, unknown>) => {
  vi.mocked(useOffline).mockReturnValue({ ...base, ...overrides } as unknown as ReturnType<typeof useOffline>);
  render(<OfflineLibrarySettings />);
};

beforeEach(() => requestPersistence.mockReset());

describe('OfflineLibrarySettings persistence warning', () => {
  it('warns when offline is on and storage is not protected', () => {
    renderWith({ enabled: true, persisted: false });
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('asks the browser again from Try again', () => {
    renderWith({ enabled: true, persisted: false });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(requestPersistence).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when storage is protected', () => {
    renderWith({ enabled: true, persisted: true });
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('stays quiet when the browser has no persist API', () => {
    renderWith({ enabled: true, persisted: null });
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('hides the warning when offline is off', () => {
    renderWith({ enabled: false, persisted: false });
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});
