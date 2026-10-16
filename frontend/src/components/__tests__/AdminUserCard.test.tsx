import { fireEvent, render, screen } from '@testing-library/react';
import { AdminUserCard } from '../AdminUserCard';
import type { AdminUser, User } from '../../types';

const { demo } = vi.hoisted(() => ({ demo: { demoMode: false } }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => demo }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k, tReplace: (k: string) => k }) }));

const owner: User = { id: 1, username: 'boss', role: 'owner', token: 't' };
const admin: User = { id: 5, username: 'helper', role: 'admin', token: 't' };
const member: AdminUser = { id: 2, username: 'member', role: 'user', disabled: false, song_count: 3, created_at: '2026-01-01' };
const handlers = { onSetRole: vi.fn(), onResetPassword: vi.fn(), onSetDisabled: vi.fn(), onDelete: vi.fn() };

beforeEach(() => { demo.demoMode = false; Object.values(handlers).forEach(h => h.mockReset()); });
const renderCard = (target: AdminUser, actor: User | null = owner) =>
  render(<AdminUserCard target={target} actor={actor} busy={false} {...handlers} />);

it('passes the target to each action', () => {
  renderCard(member);
  fireEvent.click(screen.getByRole('button', { name: 'admin.promote' }));
  expect(handlers.onSetRole).toHaveBeenCalledExactlyOnceWith(2, 'admin');
  fireEvent.click(screen.getByRole('button', { name: 'admin.resetPassword' }));
  expect(handlers.onResetPassword).toHaveBeenCalledExactlyOnceWith(2, 'member');
  fireEvent.click(screen.getByRole('button', { name: 'admin.disable' }));
  expect(handlers.onSetDisabled).toHaveBeenCalledExactlyOnceWith(2, true);
  fireEvent.click(screen.getByRole('button', { name: 'admin.delete' }));
  expect(handlers.onDelete).toHaveBeenCalledExactlyOnceWith(2, 'member');
});

it('offers demote for an admin and enable for a disabled user', () => {
  renderCard({ ...member, role: 'admin', disabled: true });
  fireEvent.click(screen.getByRole('button', { name: 'admin.demote' }));
  expect(handlers.onSetRole).toHaveBeenCalledExactlyOnceWith(2, 'user');
  fireEvent.click(screen.getByRole('button', { name: 'admin.enable' }));
  expect(handlers.onSetDisabled).toHaveBeenCalledExactlyOnceWith(2, false);
  expect(screen.getByText('disabled')).toBeInTheDocument();
});

it('leaves role changes to the owner', () => {
  renderCard(member, admin);
  expect(screen.queryByRole('button', { name: 'admin.promote' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'admin.resetPassword' })).toBeInTheDocument();
});

it.each([
  ['the owner', { ...member, role: 'owner' }, owner],
  ['an admin managed by an admin', { ...member, role: 'admin' }, admin],
  ['yourself', { ...member, id: 1 }, owner],
  ['nobody signed in', member, null],
])('shows no actions for %s', (_label, target, actor) => {
  renderCard(target, actor);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('shows no actions in demo mode', () => {
  demo.demoMode = true;
  renderCard(member);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('labels your own card', () => {
  renderCard({ ...member, id: 1, username: 'boss' });
  expect(screen.getByText(/admin\.you/)).toBeInTheDocument();
  expect(screen.getByText('@boss', { exact: false })).toBeInTheDocument();
});
