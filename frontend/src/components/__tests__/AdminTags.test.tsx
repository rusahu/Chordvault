import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminTags } from '../AdminTags';

const { api, demo, toast } = vi.hoisted(() => ({ api: vi.fn(), demo: { demoMode: false }, toast: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => demo }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k, tReplace: (k: string) => k }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));

const list = (names: string[], isDefault = false) => ({ tags: names.map((name, i) => ({ name, count: i })), isDefault });
beforeEach(() => {
  api.mockReset(); toast.mockReset(); demo.demoMode = false;
  api.mockImplementation((method: string, _path: string, body?: { tags: string[] }) =>
    Promise.resolve(method === 'GET' ? list(['worship', 'hymn', 'kids']) : method === 'DELETE' ? list(['worship'], true) : list(body!.tags)));
});
const puts = () => api.mock.calls.filter(([m]) => m === 'PUT').map(([, , body]) => body.tags);
const rowNames = () => screen.getAllByTestId('admin-tag-row').map(row => row.dataset.name);

it('adds a cleaned tag to the end and rejects a duplicate inline', async () => {
  render(<AdminTags />);
  const input = await screen.findByPlaceholderText('admin.newTag');
  await userEvent.type(input, 'Worship{Enter}');
  expect(await screen.findByText('Duplicate tag: worship')).toBeInTheDocument();
  expect(puts()).toEqual([]);
  await userEvent.clear(input);
  await userEvent.type(input, ' Advent {Enter}');
  await waitFor(() => expect(puts()).toEqual([['worship', 'hymn', 'kids', 'advent']]));
  expect(toast).toHaveBeenCalledWith('admin.tagsSaved', 'success');
  await waitFor(() => expect(rowNames()).toEqual(['worship', 'hymn', 'kids', 'advent']));
});

it('renames inline and removes after confirming', async () => {
  render(<AdminTags />);
  const rename = (await screen.findAllByRole('button', { name: 'admin.renameTag' }))[1];
  await userEvent.click(rename);
  const field = screen.getByDisplayValue('hymn');
  await userEvent.clear(field);
  await userEvent.type(field, 'Hymns{Enter}');
  await waitFor(() => expect(puts().slice(-1)[0]).toEqual(['worship', 'hymns', 'kids']));
  await userEvent.click(screen.getAllByRole('button', { name: 'admin.removeTag' })[2]);
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(puts().slice(-1)[0]).toEqual(['worship', 'hymns']));
});

it('reorders by drag and restores the list when a save fails', async () => {
  api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve(list(['worship', 'hymn', 'kids'])) : Promise.reject(new Error('Server error')));
  render(<AdminTags />);
  const rows = await screen.findAllByTestId('admin-tag-row');
  fireEvent.mouseDown(screen.getAllByTitle('admin.dragToReorder')[0]);
  fireEvent.dragStart(rows[0]);
  fireEvent.dragOver(rows[2]);
  fireEvent.dragEnd(screen.getAllByTestId('admin-tag-row')[2]);
  await waitFor(() => expect(puts()).toEqual([['hymn', 'kids', 'worship']]));
  await waitFor(() => expect(rowNames()).toEqual(['worship', 'hymn', 'kids']));
  expect(toast).toHaveBeenCalledWith('Server error', 'error');
});

it('resets after confirming, only when the list is not the default', async () => {
  render(<AdminTags />);
  await userEvent.click(await screen.findByRole('button', { name: 'admin.resetTags' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('DELETE', '/api/admin/tags'));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'admin.resetTags' })).not.toBeInTheDocument());
});

it('disables every control in demo mode', async () => {
  demo.demoMode = true;
  render(<AdminTags />);
  expect(await screen.findByPlaceholderText('admin.newTag')).toBeDisabled();
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  expect(screen.getByText('Disabled in demo mode')).toBeInTheDocument();
});

it('keeps a rename on its tag when another row is removed meanwhile', async () => {
  render(<AdminTags />);
  await userEvent.click((await screen.findAllByRole('button', { name: 'admin.renameTag' }))[2]);
  const field = screen.getByDisplayValue('kids');
  await userEvent.clear(field);
  await userEvent.type(field, 'youth');
  await userEvent.click(screen.getAllByRole('button', { name: 'admin.removeTag' })[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(puts()).toEqual([['hymn', 'kids']]));
  await userEvent.type(screen.getByDisplayValue('youth'), '{Enter}');
  await waitFor(() => expect(puts().slice(-1)[0]).toEqual(['hymn', 'youth']));
});

it('does not save when nothing changed', async () => {
  render(<AdminTags />);
  await userEvent.click((await screen.findAllByRole('button', { name: 'admin.renameTag' }))[1]);
  const field = screen.getByDisplayValue('hymn');
  await userEvent.clear(field);
  await userEvent.type(field, 'Hymn {Enter}');
  const rows = screen.getAllByTestId('admin-tag-row');
  fireEvent.mouseDown(screen.getAllByTitle('admin.dragToReorder')[0]);
  fireEvent.dragStart(rows[0]);
  fireEvent.dragEnd(rows[0]);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(puts()).toEqual([]);
  expect(toast).not.toHaveBeenCalled();
});
