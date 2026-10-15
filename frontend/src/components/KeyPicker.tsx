import { Button, Paper, SimpleGrid, Group, Text } from '@mantine/core';
import { normalizeKey, ALL_KEYS, ALL_KEYS_MINOR } from '../lib/keys';

interface KeyPickerProps {
  currentKey: string;
  onPickKey: (key: string) => void;
  isModified?: boolean;
  onSaveOnline?: () => void;
  onSaveLocal?: () => void;
}

export function KeyPicker({
  currentKey,
  onPickKey,
  isModified,
  onSaveOnline,
  onSaveLocal
}: KeyPickerProps) {
  const norm = normalizeKey(currentKey);
  const isMinor = norm && norm.endsWith('m') && norm.length > 1;
  const keys = isMinor ? ALL_KEYS_MINOR : ALL_KEYS;

  return (
    <Paper withBorder p="md" mb="sm" className="key-picker" id="key-picker" role="group" aria-label="Transpose key">
      <SimpleGrid cols={{ base: 4, sm: 6 }} spacing="xs">
        {keys.map((k) => (
          <Button
            key={k}
            px="xs"
            mih={44}
            className={`key-pill${k === norm ? ' active' : ''}`}
            variant={k === norm ? 'light' : 'default'}
            aria-pressed={k === norm}
            onClick={() => onPickKey(k)}
          >
            {k}
          </Button>
        ))}
      </SimpleGrid>
      {isModified && (
        <Group gap="xs" mt="sm">
          <Text size="sm">Save this key?</Text>
          <Group gap="xs">
            {onSaveOnline && (
              <Button size="xs" onClick={onSaveOnline}>
                SAVE (Online)
              </Button>
            )}
            {onSaveLocal && (
              <Button variant="default" size="xs" onClick={onSaveLocal}>
                Save (Local)
              </Button>
            )}
          </Group>
        </Group>
      )}
    </Paper>
  );
}
