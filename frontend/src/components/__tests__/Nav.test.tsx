import { fireEvent, render, screen } from '@testing-library/react';
import { Nav } from '../Nav';

vi.mock('../../context/I18nContext', () => import('../../test/i18nMock'));

const auth = vi.hoisted(() => ({ user: null as null | { id: number; username: string }, isAdmin: false }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ ...auth, logout: vi.fn() }) }));

function screenWidth(wide: boolean) {
  window.matchMedia = vi.fn((media: string) => ({
    matches: wide && media.includes('min-width'), media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

async function openAccountMenu() {
  render(<Nav view="browse" navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent?.trim());
}

describe('Nav', () => {
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; auth.user = null; auth.isAdmin = false; });

  it('names the home button even when the brand text is hidden on phones', () => {
    render(<Nav view="browse" navigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'ChordVault home' })).toBeInTheDocument();
  });

  it('keeps phone-only items out of the account menu on wider screens, so arrow keys never land on a hidden item', async () => {
    auth.user = { id: 1, username: 'admin' };
    auth.isAdmin = true;
    screenWidth(true);
    expect(await openAccountMenu()).toEqual(['My Songs', 'Settings', 'Sign out']);
  });

  it('moves Admin and the theme toggle into the account menu on phones', async () => {
    auth.user = { id: 1, username: 'admin' };
    auth.isAdmin = true;
    screenWidth(false);
    expect(await openAccountMenu()).toEqual(['My Songs', 'Settings', 'Admin', 'Dark theme', 'Sign out']);
  });
});
