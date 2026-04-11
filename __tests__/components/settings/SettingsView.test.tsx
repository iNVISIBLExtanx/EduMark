import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from '@/components/settings/SettingsView';

const mockTutorProfile = {
  tutor: {
    id: '1',
    email: 'test@example.com',
    full_name: 'John Doe',
    marking_language: 'sinhala',
    plan: 'starter',
  } as { id: string; email: string; full_name: string; marking_language: string; plan: string } | undefined,
  isLoading: false,
  error: undefined as Error | undefined,
  mutate: vi.fn(),
};

const mockTutorSubjects = {
  subjects: [
    { subject_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', subjects: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', name: 'Physics', code: 'PHY' } },
    { subject_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', subjects: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', name: 'Chemistry', code: 'CHE' } },
  ],
  isLoading: false,
  error: undefined,
  mutate: vi.fn(),
};

const mockSubscription = {
  subscription: {
    plan: 'starter',
    ai_minutes_used: 10,
    ai_minutes_limit: 50,
    subscription_status: 'active',
    billing_period_end: '2026-04-19T00:00:00Z',
  },
  available: 40,
  usagePercent: 20,
  isPastDue: false,
  isFree: false,
  isLoading: false,
  error: undefined,
  mutate: vi.fn(),
};

const mockAllSubjects = {
  subjects: [
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee04', name: 'Combined Maths', code: 'CMATH' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', name: 'Physics', code: 'PHY' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', name: 'Chemistry', code: 'CHE' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee03', name: 'Biology', code: 'BIO' },
  ],
  isLoading: false,
  error: undefined,
};

vi.mock('@/hooks/useTutorProfile', () => ({
  useTutorProfile: () => mockTutorProfile,
}));

vi.mock('@/hooks/useTutorSubjects', () => ({
  useTutorSubjects: () => mockTutorSubjects,
}));

vi.mock('@/hooks/useAllSubjects', () => ({
  useAllSubjects: () => mockAllSubjects,
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

vi.mock('@/components/billing/AiMinutesBar', () => ({
  AiMinutesBar: () => <div data-testid="ai-minutes-bar" />,
}));

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mutable mock state
  mockTutorProfile.tutor = {
    id: '1',
    email: 'test@example.com',
    full_name: 'John Doe',
    marking_language: 'sinhala',
    plan: 'starter',
  };
  mockTutorProfile.isLoading = false;
  mockTutorProfile.error = undefined;
  mockTutorProfile.mutate = vi.fn();
  mockTutorSubjects.subjects = [
    { subject_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', subjects: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', name: 'Physics', code: 'PHY' } },
    { subject_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', subjects: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', name: 'Chemistry', code: 'CHE' } },
  ];
  mockTutorSubjects.isLoading = false;
  mockTutorSubjects.mutate = vi.fn();
  mockSubscription.subscription = {
    plan: 'starter',
    ai_minutes_used: 10,
    ai_minutes_limit: 50,
    subscription_status: 'active',
    billing_period_end: '2026-04-19T00:00:00Z',
  };
  mockSubscription.isFree = false;
  mockSubscription.isLoading = false;
  mockAllSubjects.subjects = [
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee04', name: 'Combined Maths', code: 'CMATH' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', name: 'Physics', code: 'PHY' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', name: 'Chemistry', code: 'CHE' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee03', name: 'Biology', code: 'BIO' },
  ];
  mockAllSubjects.isLoading = false;
});

describe('SettingsView', () => {
  it('shows loading state (Skeleton) when hooks are loading', () => {
    mockTutorProfile.isLoading = true;
    const { container } = render(<SettingsView />);
    // Loading state renders Skeleton components, not "Loading..." text
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows profile info (name and email)', () => {
    render(<SettingsView />);
    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('test@example.com')).toBeDefined();
  });

  it('shows LanguageBadge with marking language (Sinhala script)', () => {
    render(<SettingsView />);
    // Component shows "සිංහල" for sinhala marking_language
    expect(screen.getByText('සිංහල')).toBeDefined();
  });

  it('shows subject badges for each subject', () => {
    render(<SettingsView />);
    expect(screen.getByText('Physics')).toBeDefined();
    expect(screen.getByText('Chemistry')).toBeDefined();
  });

  it('shows billing section with plan info under "Subscription & Billing" heading', () => {
    render(<SettingsView />);
    // Billing section heading is "Subscription & Billing"
    expect(screen.getByText('Subscription & Billing')).toBeDefined();
    // Plan shown as text (e.g., "starter") inside the plan badge span
    expect(screen.getByText('starter')).toBeDefined();
  });

  it('shows Manage Billing button', () => {
    render(<SettingsView />);
    expect(screen.getByText('Manage Billing')).toBeDefined();
  });

  it('shows "View Plans" link when isFree (not "Upgrade Plan")', () => {
    mockSubscription.isFree = true;
    render(<SettingsView />);
    // Component renders "View Plans" button (not "Upgrade Plan")
    expect(screen.getByText('View Plans')).toBeDefined();
  });

  it('does not show "View Plans" link when not free', () => {
    mockSubscription.isFree = false;
    render(<SettingsView />);
    expect(screen.queryByText('View Plans')).toBeNull();
    expect(screen.queryByText('Upgrade Plan')).toBeNull();
  });

  it('shows error message when tutor hook has error', () => {
    mockTutorProfile.isLoading = false;
    mockTutorProfile.error = new Error('Failed to load');
    render(<SettingsView />);
    expect(screen.getByText('Failed to load')).toBeDefined();
  });

  it('shows Edit Profile button in view mode', () => {
    render(<SettingsView />);
    expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeDefined();
  });

  it('switches to edit mode when Edit Profile clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));
    expect(screen.getByLabelText('Full Name')).toBeDefined();
    // Marking Language uses a shadcn Select (not a native select), so check the label exists
    expect(screen.getByText('Marking Language')).toBeDefined();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
  });

  it('pre-fills form with current name value in edit mode', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

    const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
    expect(nameInput.value).toBe('John Doe');
  });

  it('shows all subjects in edit mode checkbox grid with labels', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

    // In edit mode the Subjects You Teach section is shown.
    // Subjects appear as label text alongside checkboxes.
    // "Physics" and "Chemistry" may appear multiple times (badges + form) — use getAllByText.
    expect(screen.getByText('Combined Maths')).toBeDefined();
    expect(screen.getAllByText('Physics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chemistry').length).toBeGreaterThan(0);
    expect(screen.getByText('Biology')).toBeDefined();
    // The label for subjects section should be present
    expect(screen.getByText('Subjects You Teach')).toBeDefined();
  });

  it('hides Edit Profile button in edit mode', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));
    expect(screen.queryByRole('button', { name: /Edit Profile/i })).toBeNull();
  });

  it('returns to view mode when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

    // Verify we are in edit mode
    expect(screen.getByLabelText('Full Name')).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    // Should be back in view mode
    expect(screen.queryByLabelText('Full Name')).toBeNull();
    expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeDefined();
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('calls PATCH and mutates on save', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    const mockApiFetch = vi.mocked(apiFetch);
    mockApiFetch.mockResolvedValueOnce({});

    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

    // Modify the name
    const nameInput = screen.getByLabelText('Full Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/tutor/profile', {
        method: 'PATCH',
        body: expect.stringContaining('Jane Smith'),
      });
    });

    await waitFor(() => {
      expect(mockTutorProfile.mutate).toHaveBeenCalled();
      expect(mockTutorSubjects.mutate).toHaveBeenCalled();
    });

    // Should return to view mode after save
    await waitFor(() => {
      expect(screen.queryByLabelText('Full Name')).toBeNull();
    });
  });

  it('shows error message when save fails', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    const mockApiFetch = vi.mocked(apiFetch);
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });

    // Should still be in edit mode
    expect(screen.getByLabelText('Full Name')).toBeDefined();
  });
});
