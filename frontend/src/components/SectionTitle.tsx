import { Title, type TitleProps } from '@mantine/core';

export function SectionTitle(props: TitleProps) {
  return <Title order={3} fz={20} mt={28} mb={12} {...props} />;
}
