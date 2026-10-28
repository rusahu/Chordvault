import { useEffect } from 'react';
import { useElementSize } from '@mantine/hooks';
import { useOffline } from '../context/OfflineContext';
import { ActionIcon, Button, Group, Menu, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconChevronDown, IconTrash } from '@tabler/icons-react';
import { useI18n } from '../context/I18nContext';

interface EditorActionBarProps {
  title: string;
  dirty: boolean;
  onLeave: () => void;
  saveLabel: string;
  onSave: () => void;
  onSaveAsVersion?: () => void;
  onDelete?: () => void;
}

export function EditorActionBar({ title, dirty, onLeave, saveLabel, onSave, onSaveAsVersion, onDelete }: EditorActionBarProps) {
  const { t } = useI18n();
  const { readOnly } = useOffline();
  const hasMenu = !!(onSaveAsVersion || onDelete);
  const { ref, height } = useElementSize<HTMLElement>();
  // Sticky things under this bar (the chord bar) stop below it.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--editor-bar-h', `${height}px`);
    return () => { root.removeProperty('--editor-bar-h'); };
  }, [height]);
  return (
    <Group ref={ref} component="header" className="editor-action-bar" wrap="nowrap" gap="xs" pos="sticky" top={0} px="sm" py="xs" mb="lg" bg="var(--cv-band)" bdrs={14} style={{ zIndex: 50 }}>
      <ActionIcon size="input-md" aria-label={t('songEdit.back')} title={t('songEdit.back')} onClick={onLeave}>
        <IconArrowLeft size={22} aria-hidden />
      </ActionIcon>
      <Stack gap={0} flex={1} miw={0}>
        <Title order={1} fz={{ base: 18, sm: 21 }} lh={1.15} style={{ overflowWrap: 'anywhere' }}>{title}</Title>
        {dirty && <Text span size="sm" c="dimmed" fw={500}>{t('songEdit.unsaved')}</Text>}
      </Stack>
      <Button variant="default" visibleFrom="xs" onClick={onLeave}>{t('songEdit.cancel')}</Button>
      <Button.Group>
        <Button disabled={readOnly} variant="filled" onClick={onSave}>{saveLabel}</Button>
        {hasMenu && (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <Button disabled={readOnly} variant="filled" px={9} aria-label={t('songEdit.moreActions')} title={t('songEdit.moreActions')}>
                <IconChevronDown size={18} aria-hidden />
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {onSaveAsVersion && <Menu.Item onClick={onSaveAsVersion}>{t('songEdit.saveAsNewVersion')}</Menu.Item>}
              {onSaveAsVersion && onDelete && <Menu.Divider />}
              {onDelete && <Menu.Item color="red" leftSection={<IconTrash size={16} aria-hidden />} onClick={onDelete}>{t('songEdit.deleteSong')}</Menu.Item>}
            </Menu.Dropdown>
          </Menu>
        )}
      </Button.Group>
    </Group>
  );
}
