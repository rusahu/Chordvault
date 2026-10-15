import { TextInput } from '@mantine/core';
import { SearchRow } from './SearchRow';

export interface DateRange { dateFrom: string; dateTo: string }

export function DateRangeFilter({ dateFrom, dateTo, onChange }: DateRange & { onChange: (range: DateRange) => void }) {
  return (
    <SearchRow mt={-10}>
      <TextInput label={<>From</>} type="date" flex={1} miw={0} value={dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value, dateTo })} />
      <TextInput label={<>To</>} type="date" flex={1} miw={0} value={dateTo} onChange={(e) => onChange({ dateFrom, dateTo: e.target.value })} />
    </SearchRow>
  );
}
