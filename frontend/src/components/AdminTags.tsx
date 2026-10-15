import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Divider, Flex, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconGripVertical, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { useApi } from '../hooks/useApi';
import { useBusyAction } from '../hooks/useBusyAction';
import { useDragReorder } from '../hooks/useDragReorder';
import { useDemo } from '../context/DemoContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { notifyError } from '../lib/errors';
import { DEFAULT_TAGS } from '../lib/constants';
import { cleanTagName, tagLabel, tagNameError } from '../lib/tagName';
import type { AdminTagList } from '../types';

interface Editing { name: string; value: string; error: string | null }

export function AdminTags() {
  const apiCall = useApi();
  const { demoMode } = useDemo();
  const { t, tReplace } = useI18n();
  const [data, setData] = useState<AdminTagList | null>(null);
  const { busy, run: runOnce } = useBusyAction();
  const restoreOrder = useRef<(list: string[]) => void>(() => {});
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const names = data?.tags.map(tag => tag.name) ?? [];
  const disabled = demoMode || busy;

  useEffect(() => {
    apiCall<AdminTagList>('GET', '/api/admin/tags')
      .then(result => { if (Array.isArray(result?.tags)) setData(result); })
      .catch(() => {});
  }, [apiCall]);

  const run = (request: () => Promise<AdminTagList>) => runOnce(async () => {
    setData(await request());
    toast(t('admin.tagsSaved'), 'success');
  }, (e) => {
    restoreOrder.current(names);
    notifyError(e);
  });

  const save = async (list: string[]) => {
    if (list.length === names.length && list.every((name, i) => name === names[i])) return true;
    return run(() => apiCall<AdminTagList>('PUT', '/api/admin/tags', { tags: list }));
  };
  const { items, setItems, dragProps, handleProps } = useDragReorder(names, save);
  useEffect(() => { restoreOrder.current = setItems; }, [setItems]);
  const countOf = (name: string) => data?.tags.find(tag => tag.name === name)?.count ?? 0;

  const add = async () => {
    const error = tagNameError(newName, names);
    setAddError(error);
    if (!error && await save([...names, cleanTagName(newName)])) setNewName('');
  };

  const commitRename = async () => {
    if (!editing) return;
    const error = tagNameError(editing.value, names.filter(name => name !== editing.name));
    if (error) { setEditing({ ...editing, error }); return; }
    if (await save(names.map(name => (name === editing.name ? cleanTagName(editing.value) : name)))) setEditing(null);
  };

  const remove = (name: string) => {
    const count = countOf(name);
    modals.openConfirmModal({
      children: count ? tReplace('admin.confirmRemoveTag', { name, count }) : tReplace('admin.confirmRemoveUnusedTag', { name }),
      onConfirm: () => save(names.filter(other => other !== name)),
    });
  };

  const reset = () => modals.openConfirmModal({
    children: tReplace('admin.confirmResetTags', { count: DEFAULT_TAGS.length }),
    onConfirm: () => run(() => apiCall<AdminTagList>('DELETE', '/api/admin/tags')),
  });

  if (!data) return null;

  return (
    <>
      <Group justify="space-between" align="center">
        <h3 className="admin-section-title">{t('admin.songTags')}</h3>
        {!data.isDefault && <Button variant="subtle" size="xs" onClick={reset} disabled={disabled}>{t('admin.resetTags')}</Button>}
      </Group>
      <Paper withBorder bg="var(--surface)" radius="var(--radius)" py={16} px={20} mb={20}>
        <div className="muted-text">{t('admin.songTagsHelp')}</div>
        {demoMode && <div className="muted-text" style={{ fontSize: 12, marginTop: 4 }}>{t('common.demoDisabled')}</div>}
        <Stack gap={0} mt={12}>
          {items.map((name, idx) => (
            <Box key={name}>
              <Divider />
              <Group data-testid="admin-tag-row" data-name={name} wrap="nowrap" gap={8} py={6} {...dragProps(idx)}>
                <Box className="setlist-drag-handle" title={t('admin.dragToReorder')} {...(disabled ? {} : handleProps(idx))}>
                  <IconGripVertical size={20} aria-hidden />
                </Box>
                {editing?.name === name ? (
                  <>
                    <TextInput
                      flex={1}
                      autoFocus
                      value={editing.value}
                      error={editing.error}
                      disabled={disabled}
                      aria-label={tReplace('admin.renameTag', { name })}
                      onChange={e => setEditing({ ...editing, value: e.currentTarget.value, error: null })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                    <ActionIcon variant="subtle" size={44} aria-label={t('common.confirm')} onClick={commitRename} disabled={disabled}><IconCheck size={18} /></ActionIcon>
                    <ActionIcon variant="subtle" size={44} aria-label={t('common.cancel')} onClick={() => setEditing(null)} disabled={disabled}><IconX size={18} /></ActionIcon>
                  </>
                ) : (
                  <>
                    <Flex flex={1} miw={0} direction={{ base: 'column', xs: 'row' }} gap={{ base: 0, xs: 12 }} align={{ base: 'flex-start', xs: 'center' }}>
                      <Text fw={600}>{tagLabel(t, name)}</Text>
                      <Text c="dimmed" fz={13}>{tReplace('admin.tagUsage', { count: countOf(name) })}</Text>
                    </Flex>
                    <ActionIcon variant="subtle" size={44} aria-label={tReplace('admin.renameTag', { name })} onClick={() => setEditing({ name, value: name, error: null })} disabled={disabled}><IconPencil size={18} /></ActionIcon>
                    <ActionIcon variant="subtle" size={44} aria-label={tReplace('admin.removeTag', { name })} onClick={() => remove(name)} disabled={disabled}><IconTrash size={18} /></ActionIcon>
                  </>
                )}
              </Group>
            </Box>
          ))}
          <Divider />
        </Stack>
        <Group mt={14} gap={8} align="flex-start" wrap="nowrap">
          <TextInput
            flex={1}
            placeholder={t('admin.newTag')}
            aria-label={t('admin.newTag')}
            value={newName}
            error={addError}
            disabled={disabled}
            onChange={e => { setNewName(e.currentTarget.value); setAddError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
          />
          <Button onClick={add} disabled={disabled}>{t('admin.addTag')}</Button>
        </Group>
      </Paper>
    </>
  );
}
