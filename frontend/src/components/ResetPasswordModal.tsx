import { Button, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { ContextModalProps } from '@mantine/modals';
import { MIN_PASSWORD_LENGTH } from '../lib/constants';

export function ResetPasswordModal({ context, id, innerProps }: ContextModalProps<{ onSubmit: (password: string) => void }>) {
  const form = useForm({ initialValues: { password: '' }, validate: { password: value => value.length >= MIN_PASSWORD_LENGTH ? null : `Password must be at least ${MIN_PASSWORD_LENGTH} characters` } });
  return <form onSubmit={form.onSubmit(({ password }) => { context.closeModal(id); innerProps.onSubmit(password); })}>
    <Stack><PasswordInput label="New password" data-autofocus autoComplete="new-password" {...form.getInputProps('password')} /><Button type="submit">Reset password</Button></Stack>
  </form>;
}
