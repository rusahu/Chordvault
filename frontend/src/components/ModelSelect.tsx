import { NativeSelect, type NativeSelectProps } from '@mantine/core';
import type { OcrModels } from '../lib/settingsApi';

type ModelSelectProps = Omit<NativeSelectProps, 'data' | 'onChange'> & {
  models: OcrModels['models'];
  onChange: (model: string) => void;
};

export function ModelSelect({ models, onChange, ...props }: ModelSelectProps) {
  return <NativeSelect {...props} data={models.map(m => ({ value: m.id, label: m.label }))} onChange={e => onChange(e.currentTarget.value)} />;
}
