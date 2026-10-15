import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { SetlistPlayView } from '../SetlistPlayView';

// Renders the real view against the real chord library: the only thing mocked
// is the API. This is what covers the branch's actual feature — the player
// deriving its semitone shift from the entry's stored target_key — which every
// other suite either mocks away or reimplements.

const mockApiCall = vi.fn();
const { user } = vi.hoisted(() => ({ user: { id: 1 } }));

vi.mock('../../hooks/usePlaybackLayout', () => ({ usePlaybackLayout: () => 'tablet' }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApiCall }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: vi.fn() }));

const ENTRY = {
  entry_id: 1,
  song_id: 9,
  title: 'Song',
  artist: '',
  content: '{key: C}\n[C]Amazing [G]grace how [F]sweet',
  content_override: null,
  target_key: null as string | null,
  nashville: 0,
  bpm: null,
  youtube_url: null,
  language: 'en',
};

const setlistWith = (target_key: string | null) => ({
  id: 1,
  user_id: 1,
  name: 'SL',
  visibility: 'private',
  event_date: null,
  entries: [{ ...ENTRY, target_key }],
});

const renderPlayer = async () => {
  const { container } = render(<SetlistPlayView setlistId={1} navigate={vi.fn()} />);
  await waitFor(() => expect(container.querySelector('[data-testid="key-display"]')).toBeTruthy());
  return {
    keyLabel: () => container.querySelector('[data-testid="key-display"]')!.textContent,
    chords: () => [...container.querySelectorAll('#chord-output .chord')]
      .map((c) => c.textContent)
      .filter(Boolean),
  };
};

describe('SetlistPlayView target key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the chord sheet in the stored target key, not the written key', async () => {
    mockApiCall.mockResolvedValue(setlistWith('A'));
    const { keyLabel, chords } = await renderPlayer();

    // C -> A is -3 semitones, so C G F sounds as A E D.
    expect(keyLabel()).toBe('Key A');
    expect(chords()).toEqual(['A', 'E', 'D']);
  });

  it('renders as written when no target key is stored', async () => {
    mockApiCall.mockResolvedValue(setlistWith(null));
    const { keyLabel, chords } = await renderPlayer();

    expect(keyLabel()).toBe('Key C');
    expect(chords()).toEqual(['C', 'G', 'F']);
  });

  it('keeps a locally saved as-written reset from falling back to the pinned key', async () => {
    // The band member's explicit null must win over the owner's server key.
    localStorage.setItem('cv_setlist_overrides', JSON.stringify({ '1': { '1': { target_key: null } } }));
    mockApiCall.mockResolvedValue(setlistWith('A'));
    const { keyLabel, chords } = await renderPlayer();

    expect(keyLabel()).toBe('Key C');
    expect(chords()).toEqual(['C', 'G', 'F']);
  });

  it('converts a legacy transpose override instead of ignoring it', async () => {
    localStorage.setItem('cv_setlist_overrides', JSON.stringify({ '1': { '1': { transpose: 2 } } }));
    mockApiCall.mockResolvedValue(setlistWith(null));
    const { keyLabel, chords } = await renderPlayer();

    expect(keyLabel()).toBe('Key D');
    expect(chords()).toEqual(['D', 'A', 'G']);
  });

  it('toggles number notation on and back off with repeated keyboard shortcuts', async () => {
    mockApiCall.mockResolvedValue(setlistWith(null));
    const { chords } = await renderPlayer();
    fireEvent.keyDown(document.body, { key: 'n' });
    await waitFor(() => expect(chords()).toEqual(['1', '5', '4']));
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    await waitFor(() => expect(chords()).toEqual(['C', 'G', 'F']));
  });

  it('keeps toolbar font and columns temporary per entry while settings font saves the global default', async () => {
    const setlist = setlistWith(null);
    setlist.entries.push({ ...ENTRY, entry_id: 2, title: 'Second song' });
    mockApiCall.mockResolvedValue(setlist);
    localStorage.setItem('cv_fontsize', '0');
    const navigate = vi.fn();
    const view = render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    await screen.findByRole('button', { name: 'Key C' });
    const scale = () => document.querySelector<HTMLElement>('.chord-sheet-wrap')!.style.getPropertyValue('--font-scale');
    fireEvent.click(screen.getByRole('button', { name: 'Increase font size' }));
    fireEvent.click(screen.getByRole('button', { name: 'Multi-column layout' }));
    expect(scale()).toBe('1.12');
    expect(localStorage.getItem('cv_fontsize')).toBe('0');
    expect(document.querySelector('.chord-sheet-wrap')).toHaveClass('two-col');
    fireEvent.click(screen.getByRole('button', { name: 'Next Song' }));
    expect(scale()).toBe('');
    expect(document.querySelector('.chord-sheet-wrap')).not.toHaveClass('two-col');
    fireEvent.click(screen.getByRole('button', { name: 'Setlist defaults' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase default font size' }));
    expect(localStorage.getItem('cv_fontsize')).toBe('1');
    view.unmount();
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    await screen.findByRole('button', { name: 'Key C' });
    expect(scale()).toBe('1.12');
    expect(document.querySelector('.chord-sheet-wrap')).not.toHaveClass('two-col');
  });

  it('opens setlist defaults beside their button and Escape closes them without leaving playback', async () => {
    mockApiCall.mockResolvedValue(setlistWith(null));
    const navigate = vi.fn();
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    const button = await screen.findByRole('button', { name: 'Setlist defaults' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog');
    expect(panel).toHaveTextContent('Setlist defaults for all songs');
    fireEvent.keyDown(panel, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Setlist defaults for all songs')).not.toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Escape closes the key chooser without leaving playback', async () => {
    mockApiCall.mockResolvedValue(setlistWith(null));
    const navigate = vi.fn();
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Key C' }));
    expect(screen.getByRole('group', { name: 'Transpose key' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'C' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Transpose key' })).not.toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalled();
  });
});
