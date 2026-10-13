import { render, screen, fireEvent } from '@testing-library/react';
import { Mock } from 'vitest';
import { SetlistPlayView } from '../SetlistPlayView';
import { useSetlistPlayer } from '../../hooks/useSetlistPlayer';

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../hooks/usePlaybackLayout', () => ({ usePlaybackLayout: () => 'tablet' }));
vi.mock('../../lib/chords', async () => {
  const actual = await vi.importActual('../../lib/chords');
  return {
    ...actual,
    autoFit: vi.fn().mockReturnValue({ fontSize: -1, twoCol: true }),
    renderChordPro: vi.fn().mockReturnValue('<div id="chord-output">Song Content</div>'),
  };
});

vi.mock('../../hooks/useSetlistPlayer', () => ({
  useSetlistPlayer: vi.fn(),
}));

vi.mock('../../hooks/useApi', () => ({
  useApi: () => vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/notifications', () => ({
  showStatusNotification: vi.fn(),
}));

vi.mock('../../hooks/useSwipe', () => ({
  useSwipe: vi.fn(),
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

describe('SetlistPlayView Auto-Fit', () => {
  const navigate = vi.fn();
  const mockUpdateEntry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSetlistPlayer as Mock).mockReturnValue({
      setlist: { id: 1, title: 'Test Setlist', entries: [{ entry_id: 1, title: 'Song 1', content: 'C G' }, { entry_id: 2, title: 'Song 2', content: 'D A' }] },
      entry: { entry_id: 1, title: 'Song 1', content: 'C G' },
      index: 0,
      total: 2,
      goTo: vi.fn(),
      prev: vi.fn(),
      next: vi.fn(),
      exit: vi.fn(),
      updateEntry: mockUpdateEntry,
      isModified: false,
      saveOnline: vi.fn(),
      saveLocal: vi.fn(),
    });
  });

  it('applies the fitted layout as a session override', () => {
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);

    fireEvent.click(screen.getByTitle(/Auto-fit for this screen/));

    // autoFit is mocked to return { fontSize: -1, twoCol: true }
    expect(mockUpdateEntry).toHaveBeenCalledWith(expect.objectContaining({ _font: -1 }));
  });
});

describe('SetlistPlayView edit song', () => {
  it('opens the song editor from the More menu and comes back to the same song', async () => {
    const navigate = vi.fn();
    (useSetlistPlayer as Mock).mockReturnValue({
      setlist: { id: 4, entries: [] },
      entry: { entry_id: 1, song_id: 42, title: 'Song 3', content: 'C G' },
      index: 2,
      total: 5,
      prev: vi.fn(), next: vi.fn(), exit: vi.fn(), updateEntry: vi.fn(),
      isModified: false, saveOnline: vi.fn(), saveLocal: vi.fn(),
    });
    render(<SetlistPlayView setlistId={4} navigate={navigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'More display options' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit song' }));

    expect(navigate).toHaveBeenCalledWith('song-edit', { id: '42', back: 'setlist-play', setlist: '4', index: '2' });
  });
});
