import { Badge, Box, Button, Divider, Group, Paper, Stack } from '@mantine/core';
import { useDemo } from '../context/DemoContext';
import { useI18n } from '../context/I18nContext';
import { ROLES, manageUserError } from '../lib/constants';
import { formatDbDate, formatSongCount } from '../lib/format';
import type { AdminUser, User } from '../types';

interface AdminUserCardProps {
  target: AdminUser;
  actor: User | null;
  busy: boolean;
  onSetRole: (userId: number, role: string) => void;
  onResetPassword: (userId: number, username: string) => void;
  onSetDisabled: (userId: number, disabled: boolean) => void;
  onDelete: (userId: number, username: string) => void;
}

export function AdminUserCard({ target, actor, busy, onSetRole, onResetPassword, onSetDisabled, onDelete }: AdminUserCardProps) {
  const { demoMode } = useDemo();
  const { t } = useI18n();
  const showActions = !!actor && !manageUserError(actor, target) && !demoMode;
  const isTargetAdmin = target.role === ROLES.ADMIN;

  return (
    <Paper withBorder bg="var(--ui-card-bg)" radius="var(--radius)" py={16} px={20} shadow="sm">
      <Group justify="space-between" gap={12}>
        <Box flex="1 1 180px" miw={0}>
          <div className="song-card-title">@{target.username}{target.id === actor?.id && <span className="muted-text"> {t('admin.you')}</span>}</div>
          <div className="song-card-meta">{formatSongCount(target.song_count, t)} &middot; {t('admin.joined')} {formatDbDate(target.created_at)}</div>
        </Box>
        <Group gap={6}>
          {target.role === ROLES.OWNER && <Badge>owner</Badge>}
          {isTargetAdmin && <Badge>admin</Badge>}
          {target.disabled && <Badge color="red">disabled</Badge>}
        </Group>
      </Group>
      {showActions && (
        <Stack gap={10} mt={10}><Divider /><Group gap={6}>
          {actor.role === ROLES.OWNER && (
            <Button variant="default" size="xs" disabled={busy} onClick={() => onSetRole(target.id, isTargetAdmin ? ROLES.USER : ROLES.ADMIN)}>
              {isTargetAdmin ? t('admin.demote') : t('admin.promote')}
            </Button>
          )}
          <Button variant="default" size="xs" disabled={busy} onClick={() => onResetPassword(target.id, target.username)}>{t('admin.resetPassword')}</Button>
          <Button variant="default" size="xs" disabled={busy} onClick={() => onSetDisabled(target.id, !target.disabled)}>{target.disabled ? t('admin.enable') : t('admin.disable')}</Button>
          <Button color="red" size="xs" disabled={busy} onClick={() => onDelete(target.id, target.username)}>{t('admin.delete')}</Button>
        </Group></Stack>
      )}
    </Paper>
  );
}
