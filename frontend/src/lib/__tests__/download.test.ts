import { downloadBlob } from '../download';

const { createObjectURL, revokeObjectURL } = URL;
afterEach(() => { URL.createObjectURL = createObjectURL; URL.revokeObjectURL = revokeObjectURL; vi.restoreAllMocks(); });

it('clicks a temporary attached link for the blob and cleans up', () => {
  const blob = new Blob(['x']);
  URL.createObjectURL = vi.fn(() => 'blob:1');
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('songs.zip');
    expect(this.href).toBe('blob:1');
    expect(this.isConnected).toBe(true);
  });
  downloadBlob(blob, 'songs.zip');
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledOnce();
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
});
