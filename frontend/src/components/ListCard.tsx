import { Children, type CSSProperties, type ReactNode } from 'react';
import { Box, Flex, Group } from '@mantine/core';
import { cardButtonProps } from '../lib/cardButton';
import { CardTitle } from './CardTitle';
import { CardMeta } from './CardMeta';

interface ListCardProps {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
}

/** Clickable list row. Actions sit beside the title and wrap under it, right-aligned, when they do not fit. */
export function ListCard({ title, meta, children, actions, onClick, className, style }: ListCardProps) {
  const hasActions = Children.toArray(actions).length > 0;
  return (
    <Flex
      className={['song-card mantine-focus-auto', className].filter(Boolean).join(' ')}
      style={style}
      {...cardButtonProps(onClick)}
      align="center"
      justify="space-between"
      wrap="wrap"
      gap={{ base: 8, xs: 12 }}
      px={{ base: 16, xs: 18 }}
      py={{ base: 14, xs: 16 }}
      mih={72}
    >
      <Box className="song-card-info" flex="1 1 220px" miw={0}>
        <CardTitle>{title}</CardTitle>
        {meta && <CardMeta>{meta}</CardMeta>}
        {children}
      </Box>
      {hasActions && (
        <Group className="song-card-actions" gap={8} justify="flex-end" ml="auto" flex="0 1 auto">
          {actions}
        </Group>
      )}
    </Flex>
  );
}
