import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeminiKeySettings } from '../GeminiKeySettings';

const mockApiCall = vi.fn();

vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApiCall }));

describe('GeminiKeySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a masked replacement state when a key is configured', async () => {
    mockApiCall.mockResolvedValueOnce({ hasKey: true });
    render(<GeminiKeySettings />);

    expect(await screen.findByText('✓ Key configured')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('•••••••••••• (saved key)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Replace Key' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Key' })).toBeInTheDocument();
  });

  it('updates the configured state after saving and removing a key', async () => {
    mockApiCall
      .mockResolvedValueOnce({ hasKey: false })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    render(<GeminiKeySettings />);

    await screen.findByText('No key configured');
    expect(screen.queryByRole('button', { name: 'Remove Key' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Gemini API Key'), { target: { value: `AQ.${'a'.repeat(40)}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));

    await screen.findByText('✓ Key configured');
    expect(mockApiCall).toHaveBeenCalledWith('PUT', '/api/settings/gemini-key', { api_key: `AQ.${'a'.repeat(40)}` });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Key' }));

    await waitFor(() => expect(screen.getByText('No key configured')).toBeInTheDocument());
    expect(mockApiCall).toHaveBeenCalledWith('DELETE', '/api/settings/gemini-key');
  });
});

it('does not submit or remove another key while a replacement is pending', async () => {
  mockApiCall.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ hasKey: true }) : new Promise(() => {}));
  render(<GeminiKeySettings />); await screen.findByText('✓ Key configured');
  fireEvent.change(screen.getByLabelText('Replace Gemini API Key'), { target: { value: 'sample-key' } });
  const replace = screen.getByRole('button', { name: 'Replace Key' });
  fireEvent.click(replace); fireEvent.click(replace);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Key' }));
  expect(mockApiCall.mock.calls.filter(call => call[0] !== 'GET')).toHaveLength(1);
});

it('announces a save failure as an alert while keeping the configured status', async () => {
  mockApiCall.mockResolvedValueOnce({ hasKey: true }).mockRejectedValueOnce(new Error('Could not save key'));
  render(<GeminiKeySettings />);
  await screen.findByText('✓ Key configured');
  fireEvent.change(screen.getByLabelText('Replace Gemini API Key'), { target: { value: 'sample-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Replace Key' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save key');
  expect(screen.getByRole('status')).toHaveTextContent('✓ Key configured');
});

it('reports an empty key and a rejected save as alerts', async () => {
  mockApiCall.mockResolvedValueOnce({ hasKey: false }).mockRejectedValueOnce(new Error('Invalid API key'));
  render(<GeminiKeySettings />);
  await screen.findByText('No key configured');
  fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter an API key');
  fireEvent.change(screen.getByLabelText('Gemini API Key'), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid API key'));
  expect(screen.getByRole('button', { name: 'Save Key' })).toBeEnabled();
});

it('checks the key status once on mount', async () => {
  mockApiCall.mockReset().mockResolvedValue({ hasKey: true });
  render(<GeminiKeySettings />);
  await screen.findByText('✓ Key configured');
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(mockApiCall.mock.calls.filter(call => call[0] === 'GET')).toHaveLength(1);
});
