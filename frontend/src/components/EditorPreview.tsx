import { ActionIcon } from '@mantine/core';
import { useEffect } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { IconRestore } from '@tabler/icons-react';
import { useChordRenderer } from '../hooks/useChordRenderer';
import { ChordSheet } from './ChordSheet';
import { KeyGroup } from './ToolbarControls';

interface EditorPreviewProps {
  content: string;
  forceRender?: number;
}

/** Live preview of the editor text, with the song page's key and notation controls. */
export function EditorPreview({ content, forceRender }: EditorPreviewProps) {
  const [debouncedContent, , { flush }] = useDebouncedValue(content, 300);
  const chord = useChordRenderer(debouncedContent);

  useEffect(() => {
    if (forceRender !== undefined) flush();
  }, [forceRender, flush]);

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
        <KeyGroup currentKey={chord.currentKey} onPickKey={chord.pickKey} nashville={chord.nashville}
          nashvilleDisabled={!chord.hasKey} onNashvilleChange={chord.toggleNashville} dense />
        {chord.targetKey && (
          <ActionIcon size="input-md" variant="default" aria-label="Reset transpose" title="Reset transpose" onClick={chord.resetKey}>
            <IconRestore size={18} aria-hidden />
          </ActionIcon>
        )}
      </div>
      <ChordSheet html={chord.renderedHtml} />
    </div>
  );
}
