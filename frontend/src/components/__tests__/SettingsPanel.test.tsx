import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel';

const props = {
  nashville: false, onNashvilleChange: vi.fn(), hideYt: false, onHideYtChange: vi.fn(),
  twoCol: true, onTwoColChange: vi.fn(), fontSize: 0, onFontChange: vi.fn(), onFontReset: vi.fn(),
};

describe('SettingsPanel', () => {
  it('names itself as the default for every song', () => {
    render(<SettingsPanel {...props} />);
    expect(screen.getByText('Setlist defaults for all songs')).toBeInTheDocument();
  });

  it('offers a named reset only when the default size has changed', () => {
    const { rerender } = render(<SettingsPanel {...props} />);
    expect(screen.getByRole('button', { name: 'Reset default font size' })).toBeDisabled();
    rerender(<SettingsPanel {...props} fontSize={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset default font size' }));
    expect(props.onFontReset).toHaveBeenCalled();
  });

  it('omits Keep screen on unless the device supports it', () => {
    render(<SettingsPanel {...props} />);
    expect(screen.queryByRole('switch', { name: 'Keep screen on' })).not.toBeInTheDocument();
  });

  it('reports Keep screen on changes', () => {
    const onKeepScreenOnChange = vi.fn();
    render(<SettingsPanel {...props} keepScreenOn onKeepScreenOnChange={onKeepScreenOnChange} />);
    const toggle = screen.getByRole('switch', { name: 'Keep screen on' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onKeepScreenOnChange).toHaveBeenCalledWith(false);
  });
});
