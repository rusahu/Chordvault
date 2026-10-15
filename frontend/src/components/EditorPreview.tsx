import { Button, Popover } from '@mantine/core';
import { useState, useMemo, useEffect } from 'react';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { renderChordPro, songHasKey } from '../lib/chords';
import { ChordSheet } from './ChordSheet';
import { KeyPicker } from './KeyPicker';
import { normalizeKey, getTransposeDelta } from '../lib/keys';

interface EditorPreviewProps {
  content: string;
  debounceMs?: number;
  forceRender?: number;
}

export function EditorPreview({ content, debounceMs = 300, forceRender }: EditorPreviewProps) {
  const [debouncedContent, , { flush }] = useDebouncedValue(content, debounceMs);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [nashville, setNashville] = useState(false);
  const [keyPickerVisible, keyPicker] = useDisclosure(false);

  useEffect(() => {
    if (forceRender !== undefined) flush();
  }, [forceRender, flush]);

  // Derive current key from {key:} directive
  const currentKey = useMemo(() => {
    const m = debouncedContent.match(/\{key:\s*([^}]+)\}/i);
    return m ? normalizeKey(m[1].trim()) : '';
  }, [debouncedContent]);

  const transpose = useMemo(
    () => (targetKey && currentKey ? getTransposeDelta(currentKey, targetKey) : 0),
    [currentKey, targetKey]
  );

  const html = useMemo(
    () => renderChordPro(debouncedContent, transpose, nashville),
    [debouncedContent, transpose, nashville]
  );

  const nashvilleDisabled = !songHasKey(debouncedContent, transpose);

  // KeyPicker.onPickKey receives a key string — assign it directly
  const handlePickKey = (pickedKey: string) => {
    if (!currentKey) return;
    setTargetKey(pickedKey);
    keyPicker.close();
  };

  if (!debouncedContent.trim()) {
    return (
      <div className="editor-preview">
        <div className="editor-preview-empty">Start typing to see a live preview</div>
      </div>
    );
  }

  return (
    <div className="editor-preview">
      <div className="editor-preview-toolbar">
        {currentKey && (
          <Popover opened={keyPickerVisible} onChange={(opened) => opened ? keyPicker.open() : keyPicker.close()} trapFocus returnFocus width="min(90vw, 440px)">
          <Popover.Target><Button variant="default" size="xs" onClick={keyPicker.toggle}>
            Key: {currentKey}
          </Button></Popover.Target>
          <Popover.Dropdown><KeyPicker currentKey={currentKey} onPickKey={handlePickKey} visible={keyPickerVisible} /></Popover.Dropdown>
          </Popover>
        )}
        <Button
          onClick={() => setNashville(!nashville)}
          disabled={nashvilleDisabled}
          title="Nashville numbers"
          variant={nashville ? 'light' : 'default'}
          aria-pressed={nashville}
        >
          #
        </Button>
        {targetKey && (
          <Button variant="default" size="xs" onClick={() => setTargetKey(null)} title="Reset transpose">
            &#8634;
          </Button>
        )}
      </div>
      <ChordSheet html={html} />
    </div>
  );
}
