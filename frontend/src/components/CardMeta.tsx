import { Text, type TextProps } from '@mantine/core';
import type { ReactNode } from 'react';

/** A card's muted second line; its colour lives in CSS so a hovered card can brighten it. */
export function CardMeta({ children, ...props }: TextProps & { children: ReactNode }) {
  return <Text component="div" className="song-card-meta" fz={14} mt={2} {...props}>{children}</Text>;
}
