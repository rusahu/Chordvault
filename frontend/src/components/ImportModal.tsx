import { Modal, Button, FileInput, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useFocusReturn } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { notifyError } from '../lib/errors';
import { useStackedModalProps } from '../hooks/useStackedModalProps';
import { useActiveRef } from '../hooks/useActiveRef';
import { importSongs, ApiError, type ImportResult } from '../lib/api';
import { fileToSong, chunkSongs } from '../lib/import';
import { IMPORT_ACCEPT, IMPORT_CONFIRM_FILE_COUNT, DEMO_MAX_IMPORT } from '../lib/constants';

interface ImportModalProps {
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}

interface Summary {
  imported: number;
  skipped: { filename: string }[];
  errors: { filename: string; error: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportModal({ opened, onClose, onDone }: ImportModalProps) {
  useFocusReturn({ opened });
  const [busy, setBusy] = useState(false);
  const stacked = useStackedModalProps({ locked: busy });
  useEffect(() => { if (!opened) setBusy(false); }, [opened]);
  const close = () => { if (!busy) onClose(); };
  return (
    <Modal opened={opened} onClose={close} title="Import ChordPro files" returnFocus={false} {...stacked} closeButtonProps={{ disabled: busy }}>
      {opened && <ImportContent busy={busy} setBusy={setBusy} onClose={close} onDone={onDone} />}
    </Modal>
  );
}

function ImportContent({ busy, setBusy, onClose, onDone }: Omit<ImportModalProps, 'opened'> & { busy: boolean; setBusy: (busy: boolean) => void }) {
  const active = useActiveRef();
  const { user } = useAuth();
  const { demoMode } = useDemo();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleFiles = (selected: File[]) => {
    let picked = selected;
    if (demoMode && picked.length > DEMO_MAX_IMPORT) picked = picked.slice(0, DEMO_MAX_IMPORT);
    setFiles(picked);
    setSummary(null);
  };

  async function postBatchWithRetry(songs: { content: string }[]): Promise<ImportResult> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await importSongs(songs, user?.token as string);
      } catch (e) {
        if (e instanceof ApiError && e.status === 429 && attempt < 3) {
          await sleep(1500);
          if (!active.current) throw e;
          continue;
        }
        throw e;
      }
    }
  }

  const start = async (confirmed = false) => {
    if (busy || files.length === 0) return;
    if (!confirmed && !demoMode && files.length > IMPORT_CONFIRM_FILE_COUNT) {
      modals.openConfirmModal({ children: `You selected ${files.length} files. Import all of them?`, labels: { confirm: 'Import', cancel: 'Cancel' }, onConfirm: () => { void start(true); } });
      return;
    }

    setBusy(true);
    try {
      const texts = await Promise.all(files.map((f) => f.text()));
      if (!active.current) return;
      const songs = texts.map((t, i) => fileToSong(files[i].name, t));
      const batches = chunkSongs(songs);

      const agg: Summary = { imported: 0, skipped: [], errors: [] };
      let offset = 0;
      setTotal(songs.length);
      setProgress(0);

      for (const batch of batches) {
        const res = await postBatchWithRetry(batch);
        if (!active.current) return;
        agg.imported += res.imported;
        for (const s of res.skipped) agg.skipped.push({ filename: files[offset + s.index].name });
        for (const er of res.errors) agg.errors.push({ filename: files[offset + er.index].name, error: er.error });
        offset += batch.length;
        setProgress(offset);
      }
      setSummary(agg);
      onDone();
    } catch (e) {
      if (active.current) notifyError(e);
    } finally {
      if (active.current) setBusy(false);
    }
  };

  return (
    <Stack gap={12}>
      {!summary && (
        <>
          <FileInput
            label="Select ChordPro files"
            multiple
            value={files}
            onChange={handleFiles}
            accept={IMPORT_ACCEPT}
            disabled={busy}
            clearable
            clearButtonProps={{ 'aria-label': 'Clear selected files', disabled: busy }}
            fileInputProps={{ 'aria-label': 'ChordPro file upload' }}
          />
          {demoMode && <Text c="dimmed" fz={13}>Demo mode: only the first {DEMO_MAX_IMPORT} songs will be imported.</Text>}
          {files.length > 0 && <Text c="dimmed" fz={13}>{files.length} file(s) selected</Text>}
          {busy && <Text c="dimmed" fz={13} role="status">Importing {progress} / {total}…</Text>}
          <Button data-testid="import-start" onClick={() => start()} loading={busy} disabled={busy || files.length === 0}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </>
      )}
      {summary && (
        <Stack gap={12} data-testid="import-summary">
          <Text>
            <strong>{summary.imported}</strong> imported ·{' '}
            <strong>{summary.skipped.length}</strong> already in your library ·{' '}
            <strong>{summary.errors.length}</strong> errors
          </Text>
          {summary.errors.length > 0 && (
            <details>
              <summary>Skipped with errors ({summary.errors.length})</summary>
              <ul>{summary.errors.map((er, i) => <li key={i}>{er.filename}: {er.error}</li>)}</ul>
            </details>
          )}
          <Button onClick={onClose}>Done</Button>
        </Stack>
      )}
    </Stack>
  );
}
