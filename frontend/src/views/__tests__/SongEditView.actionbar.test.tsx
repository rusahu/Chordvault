import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SongEditView } from '../SongEditView';

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

const SONG = { id: 5, user_id: 1, title: 'It Is Well', artist: 'Horatio Spafford', content: '{title: It Is Well}\n{key: C}\n[C]When peace', visibility: 'public', bpm: null, youtube_url: null, tags: '', language: 'en' };

function serve(song: typeof SONG | null) {
  mockApiCall.mockImplementation((_method: string, path: string) => {
    if (path === '/api/settings/gemini-key') return Promise.resolve({ hasKey: false });
    if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
    if (song && path === `/api/songs/${song.id}`) return Promise.resolve(song);
    return Promise.resolve({});
  });
}

async function renderEditor(songId?: number) {
  await act(async () => { render(<SongEditView songId={songId} navigate={vi.fn()} />); });
}

describe('SongEditView action bar', () => {
  beforeEach(() => { vi.clearAllMocks(); serve(null); });

  it('new song: Save only, unsaved once something is typed', async () => {
    await renderEditor();
    expect(screen.getByRole('heading', { level: 1, name: 'songEdit.newSong' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'songEdit.moreActions' })).toBeNull();
    expect(screen.queryByText('songEdit.unsaved')).toBeNull();
    fireEvent.change(screen.getByTestId('editor'), { target: { value: '[G]Amazing grace' } });
    expect(screen.getByText('songEdit.unsaved')).toBeInTheDocument();
  });

  it('own song: loads clean, the bar menu offers Save as new version and Delete', async () => {
    serve(SONG);
    await renderEditor(5);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'songEdit.editSong' })).toBeInTheDocument());
    await waitFor(() => expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toContain('It Is Well'));
    expect(screen.queryByText('songEdit.unsaved')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.moreActions' }));
    expect(await screen.findByRole('menuitem', { name: 'songEdit.saveAsNewVersion' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'songEdit.deleteSong' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'songEdit.deleteSong' })).toBeNull();
  });

  it('song stored with Windows line endings: editor gets plain newlines, so it opens clean', async () => {
    serve({ ...SONG, content: SONG.content.replace(/\n/g, '\r\n') + '\r\n{x_language: en}' });
    await renderEditor(5);
    await waitFor(() => expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toContain('It Is Well'));
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.save' }));
    await waitFor(() => expect(mockApiCall).toHaveBeenCalledWith('PUT', '/api/songs/5', expect.anything()));
    const body = mockApiCall.mock.calls.find((c) => c[0] === 'PUT')![2] as { content: string };
    expect(body.content).not.toContain('\r');
  });

  it("someone else's song: one primary Save as my version, no menu, no Delete", async () => {
    serve({ ...SONG, user_id: 2 });
    await renderEditor(5);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'songEdit.createVersion' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'songEdit.saveAsMyVersion' })).toHaveAttribute('data-variant', 'filled');
    expect(screen.queryByRole('button', { name: 'songEdit.save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'songEdit.moreActions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'songEdit.deleteSong' })).toBeNull();
  });
});

describe('SongEditView opened from a setlist', () => {
  const returnTo = { view: 'setlist-play', params: { id: '7', index: '2' } };
  const navigate = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    serve({ ...SONG, content: SONG.content + '\n{x_language: en}' });
    await act(async () => { render(<SongEditView songId={5} returnTo={returnTo} navigate={navigate} />); });
    await waitFor(() => expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toContain('It Is Well'));
  });

  it('save goes back to the setlist instead of the song page', async () => {
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.save' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('setlist-play', { id: '7', index: '2' }, { leave: true }));
    expect(navigate).not.toHaveBeenCalledWith('song-view', expect.anything());
  });

  it('leaving goes back to the setlist', () => {
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.back' }));
    expect(navigate).toHaveBeenCalledWith('setlist-play', { id: '7', index: '2' }, { leave: true });
  });
});

it('connects tabs to persistent panels and preserves editor content when switching', async () => {
  await renderEditor();
  const edit = screen.getByRole('tab', { name: 'songView.edit' });
  const preview = screen.getByRole('tab', { name: 'Preview' });
  const panel = document.getElementById(edit.getAttribute('aria-controls')!);
  expect(panel).not.toBeNull();
  expect(panel).toHaveAttribute('aria-labelledby', edit.id);
  const editor = screen.getByTestId('editor');
  fireEvent.change(editor, { target: { value: '[C]恩典 Grace' } });
  fireEvent.click(preview);
  expect(preview).toHaveAttribute('aria-selected', 'true');
  expect(document.getElementById(preview.getAttribute('aria-controls')!)).toHaveAttribute('aria-labelledby', preview.id);
  expect(editor).not.toBeVisible();
  fireEvent.click(edit);
  expect(screen.getByTestId('editor')).toBe(editor);
  expect(editor).toHaveValue('[C]恩典 Grace');
  expect(editor).toBeVisible();
});
