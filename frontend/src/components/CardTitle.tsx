import { Text, type TextProps } from '@mantine/core';
import type { ReactNode } from 'react';

/** A card's title line; the class keeps the wrapping rules and the test and script hooks. */
export function CardTitle({ children, ...props }: TextProps & { children: ReactNode }) {
  return <Text component="div" className="song-card-title" fz={17} fw={650} lh={1.3} {...props}>{children}</Text>;
}
