import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SongEditView } from '../SongEditView';
import { SONG_ERRORS } from '../../../../shared/song-errors.mjs';

// ─── Mocks ──────────────────────────────────────────────────────────

// Mock CodeMirrorEditor as a textarea that fires onChange
vi.mock('../../components/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock EditorPreview — not needed for sync tests
vi.mock('../../components/EditorPreview', () => ({
  EditorPreview: () => <div data-testid="preview" />,
}));

// Mock OcrModal
vi.mock('../../components/OcrModal', () => ({
  OcrModal: () => null,
}));

// Mock hooks — stable references to avoid infinite re-renders from effect deps
const mockApiCall = vi.fn().mockImplementation((_method: string, path: string) => {
  if (path === '/api/settings/gemini-key') return Promise.resolve({ hasKey: false });
  if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
  return Promise.resolve({});
});
const mockUser = { id: 1, username: 'testuser', role: 'owner', token: 'fake' };
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockToast = vi.fn();
const mockT = (key: string) => key;
const mockTReplace = (key: string) => key;

vi.mock('../../hooks/useApi', () => ({
  useApi: () => mockApiCall,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAdmin: true, login: mockLogin, logout: mockLogout }),
}));

vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({
    t: mockT,
    tReplace: mockTReplace,
    loaded: true,
  }),
}));

vi.mock('../../lib/notifications', () => ({
  showStatusNotification: (...args: unknown[]) => mockToast(...args),
}));


// ─── Tests ──────────────────────────────────────────────────────────

describe('SongEditView two-way sync', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockImplementation((_method: string, path: string) => {
      if (path === '/api/settings/gemini-key') return Promise.resolve({ hasKey: false });
      if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
      return Promise.resolve({});
    });
  });

  async function renderEditor() {
    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(<SongEditView navigate={navigate} />);
    });
    return result!;
  }

  function getEditor(): HTMLTextAreaElement {
    return screen.getByTestId('editor') as HTMLTextAreaElement;
  }

  function getTitleInput(): HTMLInputElement {
    return screen.getByPlaceholderText('songEdit.titlePlaceholder') as HTMLInputElement;
  }

  function getArtistInput(): HTMLInputElement {
    return screen.getByPlaceholderText('songEdit.artistPlaceholder') as HTMLInputElement;
  }

  function getBpmInput(): HTMLInputElement {
    return screen.getByPlaceholderText('e.g. 120') as HTMLInputElement;
  }

  it('saves the latest source before metadata parsing has completed', async () => {
    await renderEditor();
    fireEvent.change(getEditor(), { target: { value: '{title: Latest}\n{x_language: en}\n[G]Latest lyrics' } });
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.save' }));
    await waitFor(() => expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/songs', expect.objectContaining({ content: expect.stringContaining('{title: Latest}') })));
  });

  it('saves a version from the latest source before the parser debounce', async () => {
    mockApiCall.mockImplementation((method: string, path: string) => {
      if (method === 'GET' && path === '/api/songs/1') return Promise.resolve({ id: 1, user_id: 1, title: 'Original', content: '{title: Original}\n{x_language: en}\n[G]Original', visibility: 'public' });
      if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
      return Promise.resolve({ id: 2 });
    });
    render(<SongEditView songId={1} navigate={navigate} />);
    await waitFor(() => expect(getEditor().value).toContain('Original'));
    fireEvent.change(getEditor(), { target: { value: '{title: Version latest}\n{x_language: en}\n[C]Version lyrics' } });
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.moreActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'songEdit.saveAsNewVersion' }));
    await waitFor(() => expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/songs/1/version', expect.objectContaining({ content: expect.stringContaining('{title: Version latest}') })));
  });

  it('shows the save-check message and posts no version for an invalid tempo', async () => {
    mockApiCall.mockImplementation((method: string, path: string) => {
      if (method === 'GET' && path === '/api/songs/1') return Promise.resolve({ id: 1, user_id: 1, title: 'Original', content: '{title: Original}\n{x_language: en}\n[G]Original', visibility: 'public' });
      if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
      return Promise.resolve({ id: 2 });
    });
    render(<SongEditView songId={1} navigate={navigate} />);
    await waitFor(() => expect(getEditor().value).toContain('Original'));
    fireEvent.change(getEditor(), { target: { value: '{title: Bad tempo}\n{tempo: 120bpm}\n{x_language: en}\n[C]a' } });
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.moreActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'songEdit.saveAsNewVersion' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(SONG_ERRORS.bpmRange, 'error'));
    expect(mockApiCall).not.toHaveBeenCalledWith('POST', '/api/songs/1/version', expect.anything());
  });

  it('opens a deletion confirmation and performs no write when canceled', async () => {
    mockApiCall.mockImplementation((method: string, path: string) => {
      if (method === 'GET' && path === '/api/songs/1') return Promise.resolve({ id: 1, user_id: 1, content: '{title: Original}\n{x_language: en}\n[G]Original', visibility: 'public' });
      if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
      return Promise.resolve({});
    });
    render(<SongEditView songId={1} navigate={navigate} />);
    await waitFor(() => expect(getEditor().value).toContain('Original'));
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.moreActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'songEdit.deleteSong' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('songEdit.confirmDelete');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockApiCall.mock.calls.filter(call => call[0] === 'DELETE')).toHaveLength(0);
  });

  // ─── Field → Editor sync ──────────────────────────────────────

  it('typing in title field adds {title:} directive to editor content', async () => {
    await renderEditor();
    const titleInput = getTitleInput();

    fireEvent.change(titleInput, { target: { value: 'Amazing Grace' } });

    const editor = getEditor();
    expect(editor.value).toContain('{title: Amazing Grace}');
  });

  it('typing in artist field adds {artist:} directive to editor content', async () => {
    await renderEditor();
    const artistInput = getArtistInput();

    fireEvent.change(artistInput, { target: { value: 'John Newton' } });

    const editor = getEditor();
    expect(editor.value).toContain('{artist: John Newton}');
  });

  it('changing BPM field adds {tempo:} directive to editor content', async () => {
    await renderEditor();
    const bpmInput = getBpmInput();

    fireEvent.change(bpmInput, { target: { value: '120' } });

    const editor = getEditor();
    expect(editor.value).toContain('{tempo: 120}');
  });

  it('clearing a field removes the directive from content', async () => {
    await renderEditor();
    const titleInput = getTitleInput();

    // First add a title
    fireEvent.change(titleInput, { target: { value: 'Test Song' } });
    expect(getEditor().value).toContain('{title: Test Song}');

    // Then clear it
    fireEvent.change(titleInput, { target: { value: '' } });
    expect(getEditor().value).not.toContain('{title:');
  });

  it('multiple fields sync independently', async () => {
    await renderEditor();

    fireEvent.change(getTitleInput(), { target: { value: 'My Song' } });
    fireEvent.change(getArtistInput(), { target: { value: 'Artist Name' } });
    fireEvent.change(getBpmInput(), { target: { value: '90' } });

    const content = getEditor().value;
    expect(content).toContain('{title: My Song}');
    expect(content).toContain('{artist: Artist Name}');
    expect(content).toContain('{tempo: 90}');
  });

  // ─── Editor → Field sync ──────────────────────────────────────

  it('typing {artist:} in editor updates artist field (debounced)', async () => {
    await renderEditor();
    const editor = getEditor();

    fireEvent.change(editor, { target: { value: '{artist: John Smith}\n[G]Lyrics' } });

    // The sync is debounced at 150ms — wait for it
    await waitFor(() => {
      expect(getArtistInput().value).toBe('John Smith');
    }, { timeout: 500 });
  });

  it('typing {tempo:} in editor updates BPM field', async () => {
    await renderEditor();
    const editor = getEditor();

    fireEvent.change(editor, { target: { value: '{tempo: 140}\n[G]Lyrics' } });

    await waitFor(() => {
      expect(getBpmInput().value).toBe('140');
    }, { timeout: 500 });
  });

  it('typing {title:} in editor updates title field', async () => {
    await renderEditor();
    const editor = getEditor();

    fireEvent.change(editor, { target: { value: '{title: From Editor}\n[G]Lyrics' } });

    await waitFor(() => {
      expect(getTitleInput().value).toBe('From Editor');
    }, { timeout: 500 });
  });

  it('editor content with multiple directives populates all fields', async () => {
    await renderEditor();
    const editor = getEditor();

    const content = '{title: Test Song}\n{artist: Test Artist}\n{tempo: 100}\n[G]Lyrics here';
    fireEvent.change(editor, { target: { value: content } });

    await waitFor(() => {
      expect(getTitleInput().value).toBe('Test Song');
      expect(getArtistInput().value).toBe('Test Artist');
      expect(getBpmInput().value).toBe('100');
    }, { timeout: 500 });
  });

  // ─── Tag sync ─────────────────────────────────────────────────

  it('clicking a tag adds {x_tags:} directive to content', async () => {
    await renderEditor();

    // TagPicker renders buttons for each preset tag
    const worshipBtn = screen.getByText('worship');
    fireEvent.click(worshipBtn);

    expect(getEditor().value).toContain('{x_tags: worship}');
  });

  it('clicking multiple tags creates comma-separated {x_tags:}', async () => {
    await renderEditor();

    fireEvent.click(screen.getByText('worship'));
    fireEvent.click(screen.getByText('praise'));

    expect(getEditor().value).toContain('{x_tags: worship,praise}');
  });

  it('toggling a tag off removes it from {x_tags:}', async () => {
    await renderEditor();

    // Add two tags
    fireEvent.click(screen.getByText('worship'));
    fireEvent.click(screen.getByText('praise'));
    expect(getEditor().value).toContain('{x_tags: worship,praise}');

    // Remove worship
    fireEvent.click(screen.getByText('worship'));
    expect(getEditor().value).toContain('{x_tags: praise}');
    expect(getEditor().value).not.toContain('worship');
  });

  // ─── Directive ordering ───────────────────────────────────────

  it('directives are inserted in correct order (title before artist before tempo)', async () => {
    await renderEditor();

    // Add in reverse order
    fireEvent.change(getBpmInput(), { target: { value: '120' } });
    fireEvent.change(getArtistInput(), { target: { value: 'Bob' } });
    fireEvent.change(getTitleInput(), { target: { value: 'Song' } });

    const content = getEditor().value;
    const titlePos = content.indexOf('{title:');
    const artistPos = content.indexOf('{artist:');
    const tempoPos = content.indexOf('{tempo:');

    expect(titlePos).toBeLessThan(artistPos);
    expect(artistPos).toBeLessThan(tempoPos);
  });
});
