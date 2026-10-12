import { render, screen, fireEvent } from '@testing-library/react';
import { Mock } from 'vitest';
import { SetlistPlayView } from '../SetlistPlayView';
import { useSetlistPlayer } from '../../hooks/useSetlistPlayer';
import { useWakeLock } from '../../hooks/useWakeLock';

vi.mock('../../hooks/useWakeLock', () => ({ useWakeLock: vi.fn(() => ({ supported: true })) }));
vi.mock('../../hooks/usePlaybackLayout', () => ({ usePlaybackLayout: () => 'tablet' }));
vi.mock('../../lib/chords', async () => {
  const actual = await vi.importActual('../../lib/chords');
  return { ...actual, renderChordPro: vi.fn().mockReturnValue('<div id="chord-output">Song Content</div>') };
});
vi.mock('../../hooks/useSetlistPlayer', () => ({ useSetlistPlayer: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: vi.fn() }));
vi.mock('../../hooks/useSwipe', () => ({ useSwipe: vi.fn() }));
vi.mock('../../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }));

const wakeLock = vi.mocked(useWakeLock);
const lastActive = () => wakeLock.mock.lastCall?.[0];

describe('SetlistPlayView keep screen on', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    wakeLock.mockReturnValue({ supported: true });
    (useSetlistPlayer as Mock).mockReturnValue({
      setlist: { id: 1, title: 'Test Setlist', entries: [{ entry_id: 1, title: 'Song 1', content: 'C G' }] },
      entry: { entry_id: 1, title: 'Song 1', content: 'C G' },
      index: 0, total: 1, goTo: vi.fn(), prev: vi.fn(), next: vi.fn(), exit: vi.fn(),
      updateEntry: vi.fn(), isModified: false, saveOnline: vi.fn(), saveLocal: vi.fn(),
    });
  });

  it('keeps the screen on by default', () => {
    render(<SetlistPlayView setlistId={1} navigate={vi.fn()} />);
    expect(lastActive()).toBe(true);
  });

  it('respects a stored false from the first render', () => {
    localStorage.setItem('cv_keep_screen_on', 'false');
    render(<SetlistPlayView setlistId={1} navigate={vi.fn()} />);
    expect(wakeLock).toHaveBeenCalled();
    expect(wakeLock.mock.calls.every(([active]) => active === false)).toBe(true);
  });

  it('turns off from the Setlist defaults panel and remembers it', () => {
    render(<SetlistPlayView setlistId={1} navigate={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Setlist defaults' })[0]);
    fireEvent.click(screen.getByRole('switch', { name: 'Keep screen on' }));
    expect(lastActive()).toBe(false);
    expect(localStorage.getItem('cv_keep_screen_on')).toBe('false');
  });

  it('hides the switch where wake lock is unsupported', () => {
    wakeLock.mockReturnValue({ supported: false });
    render(<SetlistPlayView setlistId={1} navigate={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Setlist defaults' })[0]);
    expect(screen.queryByRole('switch', { name: 'Keep screen on' })).not.toBeInTheDocument();
  });
});
