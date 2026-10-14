import type { ReactNode } from 'react';
import { ModalsProvider } from '@mantine/modals';
import { useI18n } from '../context/I18nContext';
import { appModals } from './appModals';

export function AppModalsProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const labels = { confirm: t('common.confirm', 'Confirm'), cancel: t('common.cancel', 'Cancel') };
  return <ModalsProvider modals={appModals} labels={labels}>{children}</ModalsProvider>;
}
