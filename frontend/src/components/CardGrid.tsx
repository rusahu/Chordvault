import { SimpleGrid, type SimpleGridProps } from '@mantine/core';

export function CardGrid(props: SimpleGridProps) {
  return <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12} {...props} />;
}
