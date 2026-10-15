import { fireEvent, render, screen } from '@testing-library/react';
import { EditorActionBar } from '../EditorActionBar';

vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const base = { title: 'Edit song', dirty: false, onLeave: vi.fn(), saveLabel: 'Save', onSave: vi.fn() };

describe('EditorActionBar', () => {
  it('leaves through Back or Cancel and saves through the primary button', () => {
    const onLeave = vi.fn();
    const onSave = vi.fn();
    render(<EditorActionBar {...base} onLeave={onLeave} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.back' }));
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.cancel' }));
    expect(onLeave).toHaveBeenCalledTimes(2);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('data-variant', 'filled');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Edit song' })).toBeInTheDocument();
  });

  it('says when there are unsaved changes', () => {
    const { rerender } = render(<EditorActionBar {...base} />);
    expect(screen.queryByText('songEdit.unsaved')).toBeNull();
    rerender(<EditorActionBar {...base} dirty />);
    expect(screen.getByText('songEdit.unsaved')).toBeInTheDocument();
  });

  it('has no actions menu when there is nothing extra to offer', () => {
    render(<EditorActionBar {...base} />);
    expect(screen.queryByRole('button', { name: 'songEdit.moreActions' })).toBeNull();
  });

  it('offers Save as new version and Delete from the actions menu', async () => {
    const onSaveAsVersion = vi.fn();
    const onDelete = vi.fn();
    render(<EditorActionBar {...base} onSaveAsVersion={onSaveAsVersion} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.moreActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'songEdit.saveAsNewVersion' }));
    expect(onSaveAsVersion).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'songEdit.moreActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'songEdit.deleteSong' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
