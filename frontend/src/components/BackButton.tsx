import { Button, type ButtonProps } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export function BackButton({ onClick, children, ...props }: ButtonProps & { onClick: () => void; children: ReactNode }) {
  return <Button variant="default" size="xs" leftSection={<IconArrowLeft size={14} aria-hidden />} onClick={onClick} {...props}>{children}</Button>;
}
