import { renderHook, act, waitFor } from '@testing-library/react';
import { useSetlistPlayer } from '../useSetlistPlayer';
import { resolveEffectivePreferences } from '../../lib/chords';
import { getLocalSetlists, getSetlistOverrides, saveSetlistOverride } from '../../lib/storage';
import { ApiError } from '../../lib/api';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

const mockApiCall = vi.fn();
const mockUser = { id: 1 };
const mockToast = vi.fn();

vi.mock('../useApi', () => ({
  useApi: () => mockApiCall,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../lib/notifications', () => ({
  showStatusNotification: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('../../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../../lib/storage')>('../../lib/storage');
  return {
    getSetlistOverrides: vi.fn(),
    saveSetlistOverride: vi.fn(),
    getLocalSetlists: vi.fn(() => []),
    migrateOverride: actual.migrateOverride,
  };
});

describe('useSetlistPlayer Hook', () => {
  const navigate = vi.fn();
  const mockGetOverrides = getSetlistOverrides as Mock;
  const mockSaveOverride = saveSetlistOverride as Mock;

  const mockSetlist = {
    id: 1,
    user_id: 1,
    name: 'Test Setlist',
    entries: [
      {
        entry_id: 'entry_1',
        song_id: 101,
        title: 'Song 1',
        artist: 'Artist 1',
        content: '{key: C}\n[C]a [F]b',
        content_override: null,
        target_key: 'A',
        nashville: 1,
        font: 2,
        two_col: 1,
        bpm: 120,
        youtube_url: null,
        language: 'en',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockReset();
    mockGetOverrides.mockReturnValue({});
  });

  it('loads a local setlist with its songs fetched by id', async () => {
    (getLocalSetlists as Mock).mockReturnValue([{ id: 'local_1', name: 'Mine', entries: [{ song_id: 101, title: 'Song 1', artist: '', target_key: null, nashville: 0 }] }]);
    mockApiCall.mockResolvedValue({ id: 101, title: 'Song 1', artist: 'Artist 1', content: '{key: C}\n[C]a', visibility: 'public' });
    const { result } = renderHook(() => useSetlistPlayer({ setlistId: 'local_1', isLocal: true, navigate }));
    await waitFor(() => expect(result.current.setlist?.isLocal).toBe(true));
    expect(result.current.entry?.content).toBe('{key: C}\n[C]a');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/songs/101');
  });

  it('leaves for the setlists list when a local setlist is missing', async () => {
    renderHook(() => useSetlistPlayer({ setlistId: 'local_missing', isLocal: true, navigate }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('setlists', {}, { leave: true }));
    expect(mockToast).toHaveBeenCalledWith('Local setlist not found', 'error');
  });

  it('reports a failed online load instead of a setlist', async () => {
    mockApiCall.mockRejectedValue(new ApiError('Setlist not found', 404));
    const { result } = renderHook(() => useSetlistPlayer({ setlistId: 1, navigate }));
    await waitFor(() => expect(result.current.loadError).toBe('Setlist not found'));
    expect(result.current.setlist).toBeNull();
  });

  it('does not scroll after unmounting during a song change', async () => {
    const entries = [0, 1].map(i => ({ ...mockSetlist.entries[0], entry_id: `entry_${i}` }));
    mockApiCall.mockResolvedValue({ ...mockSetlist, entries });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSetlistPlayer({ setlistId: 1, navigate }));
    await waitFor(() => expect(result.current.setlist).not.toBeNull());
    scrollTo.mockClear();
    act(() => result.current.next());
    unmount();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('uses the current index for hash navigation and removes the listener on unmount', async () => {
    const onNavigate = vi.fn();
    const entries = [0, 1, 2].map(i => ({ ...mockSetlist.entries[0], entry_id: `entry_${i}` }));
    mockApiCall.mockResolvedValue({ ...mockSetlist, entries });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSetlistPlayer({ setlistId: 1, navigate, onNavigate }));
    await waitFor(() => expect(result.current.setlist).not.toBeNull());
    const changeHash = (hash: string) => act(() => {
      history.replaceState(null, '', hash);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    try {
      changeHash('#setlist/1/play/2');
      expect(result.current.index).toBe(2);
      changeHash('#setlist/1/play/1');
      expect(result.current.index).toBe(1);
      onNavigate.mockClear();
      changeHash('#setlist/1/play/1');
      expect(onNavigate).not.toHaveBeenCalled();
      changeHash('#setlist/1/play/99');
      expect(result.current.index).toBe(1);
      expect(location.hash).toBe('#setlist/1/play/1');
      unmount();
      changeHash('#setlist/1/play/2');
      expect(onNavigate).not.toHaveBeenCalled();
    } finally {
      history.replaceState(null, '', '/');
    }
  });

  it('ignores legacy font, two_col and nashville values stored on an entry', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.setlist).not.toBeNull();
    });

    const entry = result.current.setlist!.entries[0];
    const global = { nashville: false, twoCol: false, fontSize: 0, hideYt: false };
    expect(resolveEffectivePreferences(entry, global)).toEqual(global);
  });

  it('does not trigger isModified when session layout options are changed, but triggers when the key changes', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.entry).not.toBeNull();
    });

    expect(result.current.isModified).toBe(false);

    // Update session font scale override
    act(() => {
      result.current.updateEntry({ _font: 3 });
    });
    expect(result.current.isModified).toBe(false);

    // Update session column layout override
    act(() => {
      result.current.updateEntry({ _twoCol: true });
    });
    expect(result.current.isModified).toBe(false);

    // Update the target key (should trigger isModified)
    act(() => {
      result.current.updateEntry({ target_key: 'C' });
    });
    expect(result.current.isModified).toBe(true);
  });

  it('saves only the target key to server during saveOnline', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.entry).not.toBeNull();
    });

    // Update the target key
    act(() => {
      result.current.updateEntry({ target_key: 'C' });
    });

    mockApiCall.mockResolvedValueOnce({ success: true });

    await act(async () => {
      await result.current.saveOnline();
    });

    // Verify PUT request only sends target_key
    expect(mockApiCall).toHaveBeenLastCalledWith(
      'PUT',
      '/api/setlists/1/entries/entry_1',
      { target_key: 'C' }
    );
    expect(result.current.isModified).toBe(false);
  });

  it('shows the server error when saving the key to the cloud fails', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);
    const { result } = renderHook(() => useSetlistPlayer({ setlistId: 1, navigate }));
    await waitFor(() => expect(result.current.entry).not.toBeNull());
    act(() => { result.current.updateEntry({ target_key: 'C' }); });
    mockApiCall.mockRejectedValueOnce(new Error('Entry not found'));
    await act(async () => { await result.current.saveOnline(); });
    expect(mockToast).toHaveBeenLastCalledWith('Entry not found', 'error');
  });

  it('saves only the target key locally during saveLocal', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.entry).not.toBeNull();
    });

    // Update the target key and session layout
    act(() => {
      result.current.updateEntry({ target_key: 'G', _font: 1 });
    });

    act(() => {
      result.current.saveLocal();
    });

    // Verify only target_key is stored
    expect(mockSaveOverride).toHaveBeenCalledWith(1, 'entry_1', {
      target_key: 'G',
    });
    expect(result.current.isModified).toBe(false);
  });

  describe('target key assignment', () => {
    // Scope: this only covers updateEntry's merge, which is where a picked key
    // enters the hook's state. The shift the key produces is computed at render
    // time, not here — see SetlistPlayView.key.test.tsx for that.
    it('replaces the entry target key on every update', async () => {
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      for (const key of ['A', 'G', 'A', 'G', 'C', 'F#']) {
        act(() => { result.current.updateEntry({ target_key: key }); });
        expect(result.current.entry!.target_key).toBe(key);
      }
    });

    it('treats a null target key as an unsaved reset to as-written', async () => {
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      act(() => { result.current.updateEntry({ target_key: null }); });
      expect(result.current.entry!.target_key).toBe(null);
      expect(result.current.isModified).toBe(true);
    });

    it('converts a legacy transpose override on load', async () => {
      mockGetOverrides.mockReturnValue({ entry_1: { transpose: 2 } });
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      // mockSetlist entry_1 content is in C, so +2 is D
      expect(result.current.entry!.target_key).toBe('D');
      expect(mockSaveOverride).toHaveBeenCalled();
    });
  });
});
