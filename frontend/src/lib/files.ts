/** FileReader as a promise; text reads honour a byte order mark (UTF-16 from Windows Notepad), which Blob.text() does not. */
export function readFile(file: File, as: 'text' | 'dataURL'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    if (as === 'text') reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}
