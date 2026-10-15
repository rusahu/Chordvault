import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Mock } from 'vitest';
import { SetlistPlayView } from '../SetlistPlayView';
import { useSetlistPlayer } from '../../hooks/useSetlistPlayer';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { showStatusNotification } from '../../lib/notifications';
import { SONG_ERRORS } from '../../../../shared/song-errors.mjs';

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

const apiCall = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useApi', () => ({
  useApi: () => apiCall,
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

describe('SetlistPlayView inline editor save as version', () => {
  const updateEntry = vi.fn();

  function renderEditor(text: string) {
    (useSetlistPlayer as Mock).mockReturnValue({
      setlist: { id: 4, entries: [] },
      entry: { entry_id: 7, song_id: 42, title: 'Song', content: '{title: Song}\n[C]a' },
      index: 0, total: 1,
      prev: vi.fn(), next: vi.fn(), exit: vi.fn(), updateEntry,
      isModified: false, saveOnline: vi.fn(), saveLocal: vi.fn(),
    });
    render(<SetlistPlayView setlistId={4} navigate={vi.fn()} />);
    const shortcuts = (useKeyboardShortcuts as Mock).mock.lastCall![0];
    act(() => shortcuts.e());
    fireEvent.change(screen.getByLabelText('Setlist chord sheet'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'setlist.saveAsVersion' }));
  }

  beforeEach(() => { vi.clearAllMocks(); });

  it('saves chords over lyrics as ChordPro with a key', async () => {
    renderEditor('{title: Song}\nG       C\nAmazing grace');
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    const saved = updateEntry.mock.calls[0][0].content_override;
    expect(saved).toMatch(/^\{key: G\}\n\{title: Song\}/);
    expect(saved).toContain('[G]Amazing');
    expect(apiCall).toHaveBeenCalledWith('POST', '/api/songs/42/version', { content: saved });
    expect(apiCall).toHaveBeenCalledWith('PUT', '/api/setlists/4/entries/7', { content_override: saved });
  });

  it('rejects an invalid tempo without saving', () => {
    renderEditor('{title: Song}\n{tempo: 120bpm}\n[C]a');
    expect(showStatusNotification).toHaveBeenCalledWith(SONG_ERRORS.bpmRange, 'error');
    expect(apiCall).not.toHaveBeenCalled();
  });
});
