import { Alert } from '@mantine/core';

/** The red banner a list shows when its last load failed. */
export function LoadErrorAlert({ message }: { message: string }) {
  return message ? <Alert color="red" mb="sm" role="alert">{message}</Alert> : null;
}
