import { ActionIcon, Box, Center, Divider, Group } from '@mantine/core';
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
      <Box p={12} className="editor-preview">
        <Center mih={200} c="dimmed" fz={14} fs="italic">Start typing to see a live preview</Center>
      </Box>
    );
  }

  return (
    <Box p={12} className="editor-preview">
      <Group gap={8} pb={8}>
        <KeyGroup currentKey={chord.currentKey} onPickKey={chord.pickKey} nashville={chord.nashville}
          nashvilleDisabled={!chord.hasKey} onNashvilleChange={chord.toggleNashville} dense />
        {chord.targetKey && (
          <ActionIcon size="input-md" variant="default" aria-label="Reset transpose" title="Reset transpose" onClick={chord.resetKey}>
            <IconRestore size={18} aria-hidden />
          </ActionIcon>
        )}
      </Group>
      <Divider mb={8} />
      <ChordSheet html={chord.renderedHtml} />
    </Box>
  );
}
