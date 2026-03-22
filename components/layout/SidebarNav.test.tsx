import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarNav } from './SidebarNav';

const mockPush = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSignOut.mockResolvedValue({});
});

describe('SidebarNav', () => {
  it('renders all navigation items', () => {
    render(<SidebarNav />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Batches')).toBeDefined();
    expect(screen.getByText('Papers')).toBeDefined();
    expect(screen.getByText('Pricing')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders logout button', () => {
    render(<SidebarNav />);
    expect(screen.getByText('Log out')).toBeDefined();
  });

  it('shows confirmation dialog when logout clicked', async () => {
    const user = userEvent.setup();
    render(<SidebarNav />);

    await user.click(screen.getByText('Log out'));

    expect(screen.getByText('Are you sure you want to log out of EduMark AI?')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    // There will be two "Log out" elements — the sidebar button and the dialog confirm button
    const logoutButtons = screen.getAllByText('Log out');
    expect(logoutButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('closes dialog when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<SidebarNav />);

    await user.click(screen.getByText('Log out'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Are you sure you want to log out of EduMark AI?')).toBeNull();
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signOut and redirects when confirmed', async () => {
    const user = userEvent.setup();
    render(<SidebarNav />);

    await user.click(screen.getByText('Log out'));
    // Click the destructive "Log out" button in the dialog
    const dialogLogoutButton = screen.getByRole('button', { name: 'Log out' });
    await user.click(dialogLogoutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('highlights active nav item', () => {
    render(<SidebarNav />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink?.className).toContain('bg-black');
  });

  it('shows app title', () => {
    render(<SidebarNav />);
    expect(screen.getByText('EduMark AI')).toBeDefined();
  });
});
