import { fireEvent, render, screen } from '@testing-library/react';
import { DateRangeFilter } from '../DateRangeFilter';

it('reports the whole range when either date changes', () => {
  const onChange = vi.fn();
  render(<DateRangeFilter dateFrom="2026-10-01" dateTo="" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
  expect(onChange).toHaveBeenLastCalledWith({ dateFrom: '2026-09-01', dateTo: '' });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-12-31' } });
  expect(onChange).toHaveBeenLastCalledWith({ dateFrom: '2026-10-01', dateTo: '2026-12-31' });
});
