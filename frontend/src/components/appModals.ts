import { modals } from '@mantine/modals';
import { SetlistNameModal } from './SetlistNameModal';
import { ResetPasswordModal } from './ResetPasswordModal';

export const appModals = { setlistName: SetlistNameModal, resetPassword: ResetPasswordModal };

export const openSetlistNameModal = (title: string, onSubmit: (name: string) => void | Promise<void>) =>
  modals.openContextModal({ modal: 'setlistName', title, innerProps: { onSubmit } });
