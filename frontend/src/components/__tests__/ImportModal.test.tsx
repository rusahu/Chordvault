import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ImportModal } from '../ImportModal';
import { importSongs } from '../../lib/api';

vi.mock('../../lib/constants', async (original) => ({
  ...await original<typeof import('../../lib/constants')>(), IMPORT_CONFIRM_FILE_COUNT: 2,
}));

vi.mock('../../lib/api', () => ({
  importSongs: vi.fn(async () => ({ imported: 1, skipped: [{ index: 1, reason: 'already_exists' }], errors: [] })),
  ApiError: class extends Error { status = 0; },
}));
vi.mock('../../hooks/useApi', () => ({ useApi: () => vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { token: 'tok' } }) }));
const demo = vi.hoisted(() => ({ enabled: false }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => ({ demoMode: demo.enabled }) }));
afterEach(() => { demo.enabled = false; });
vi.mock('../../lib/notifications', () => ({ showStatusNotification: vi.fn() }));

function file(name: string, content: string) {
  return new File([content], name, { type: 'text/plain' });
}

describe('ImportModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns focus to its opener and resets the selected files after reopening', async () => {
    function Harness() {
      const [opened, setOpened] = useState(false);
      return <><button onClick={() => setOpened(true)}>Open import</button><ImportModal opened={opened} onClose={() => setOpened(false)} onDone={vi.fn()} /></>;
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open import' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(opener);
    await userEvent.upload(screen.getByLabelText('ChordPro file upload'), [file('A.cho', '[G]a'), file('B.cho', '[G]b'), file('C.cho', '[G]c')]);
    expect(screen.getByTestId('import-start')).toBeEnabled();
    await userEvent.click(screen.getByTestId('import-start'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
    await userEvent.click(opener);
    expect(screen.getByTestId('import-start')).toBeDisabled();
    expect((screen.getByLabelText('ChordPro file upload') as HTMLInputElement).files).toHaveLength(0);
  });

  it('imports selected files and shows a summary', async () => {
    render(<ImportModal opened onClose={() => {}} onDone={() => {}} />);
    const input = screen.getByLabelText('ChordPro file upload') as HTMLInputElement;
    await userEvent.upload(input, [file('A.cho', '[G]a'), file('B.cho', '[G]a')]);
    await userEvent.click(screen.getByTestId('import-start'));
    await waitFor(() => {
      expect(screen.getByTestId('import-summary')).toHaveTextContent('1 imported');
      expect(screen.getByTestId('import-summary')).toHaveTextContent('1 already in your library');
    });
  });

  it('reads a UTF-16 file saved with a byte order mark', async () => {
    const text = '{title: 喜樂}\n[G]a';
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes.set([0xff, 0xfe]);
    for (let i = 0; i < text.length; i++) new DataView(bytes.buffer).setUint16(2 + i * 2, text.charCodeAt(i), true);
    render(<ImportModal opened onClose={() => {}} onDone={() => {}} />);
    await userEvent.upload(screen.getByLabelText('ChordPro file upload'), [new File([bytes], 'U.cho', { type: 'text/plain' })]);
    await userEvent.click(screen.getByTestId('import-start'));
    await waitFor(() => expect(vi.mocked(importSongs)).toHaveBeenCalled());
    expect(vi.mocked(importSongs).mock.calls[0][0]).toEqual([{ content: text }]);
  });

  it('Escape dismisses only the bulk confirmation and performs no import', async () => {
    const onClose = vi.fn();
    render(<ImportModal opened onClose={onClose} onDone={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('ChordPro file upload'), [file('A.cho', '[G]a'), file('B.cho', '[G]b'), file('C.cho', '[G]c')]);
    await userEvent.click(screen.getByTestId('import-start'));
    expect(await screen.findByText('You selected 3 files. Import all of them?')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('You selected 3 files. Import all of them?')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(importSongs).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-start')).toBeEnabled();
  });

  it('Cancel performs no import and a pending import cannot be repeated or dismissed', async () => {
    const onClose = vi.fn();
    render(<ImportModal opened onClose={onClose} onDone={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('ChordPro file upload'), [file('A.cho', '[G]a'), file('B.cho', '[G]b'), file('C.cho', '[G]c')]);
    await userEvent.click(screen.getByTestId('import-start'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(importSongs).not.toHaveBeenCalled();
    vi.mocked(importSongs).mockImplementationOnce(() => new Promise(() => {}));
    await userEvent.click(screen.getByTestId('import-start'));
    const confirmation = screen.getByText('You selected 3 files. Import all of them?').closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(importSongs).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Clear selected files' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selected files' }));
    expect((screen.getByLabelText('ChordPro file upload') as HTMLInputElement).files).toHaveLength(3);
    fireEvent.click(screen.getByTestId('import-start'));
    fireEvent.keyDown(screen.getByTestId('import-start'), { key: 'Escape' });
    expect(importSongs).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

it('clearing the selected files disables import and allows selecting them again', async () => {
  render(<ImportModal opened onClose={vi.fn()} onDone={vi.fn()} />);
  const chosen = file('Again.cho', '[C]Again');
  await userEvent.upload(screen.getByLabelText('ChordPro file upload'), chosen);
  await userEvent.click(screen.getByRole('button', { name: 'Clear selected files' }));
  expect(screen.getByTestId('import-start')).toBeDisabled();
  await userEvent.upload(screen.getByLabelText('ChordPro file upload'), chosen);
  expect(screen.getByTestId('import-start')).toBeEnabled();
});

it('truncates a demo selection to the existing import limit', async () => {
  demo.enabled = true;
  vi.mocked(importSongs).mockClear();
  render(<ImportModal opened onClose={vi.fn()} onDone={vi.fn()} />);
  await userEvent.upload(screen.getByLabelText('ChordPro file upload'), Array.from({ length: 25 }, (_, i) => file(`${i}.cho`, `[G]Song ${i}`)));
  await userEvent.click(screen.getByTestId('import-start'));
  await waitFor(() => expect(importSongs).toHaveBeenCalledTimes(1));
  expect(vi.mocked(importSongs).mock.calls[0][0]).toHaveLength(20);
});
