import { Text, type TextProps } from '@mantine/core';
import type { StatusMessage } from '../hooks/useStatusMessage';

export function StatusText({ status, ...props }: { status: StatusMessage | null } & TextProps) {
  if (!status) return null;
  return (
    <Text size="sm" c={status.error ? 'var(--danger)' : 'var(--success)'} role={status.error ? 'alert' : 'status'} {...props}>
      {status.text}
    </Text>
  );
}
