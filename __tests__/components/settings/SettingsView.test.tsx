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
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', name: 'Physics', code: 'PHY' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', name: 'Chemistry', code: 'CHE' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee03', name: 'Biology', code: 'BIO' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee04', name: 'Combined Maths', code: 'CMATH' },
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
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', name: 'Physics', code: 'PHY' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02', name: 'Chemistry', code: 'CHE' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee03', name: 'Biology', code: 'BIO' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee04', name: 'Combined Maths', code: 'CMATH' },
  ];
  mockAllSubjects.isLoading = false;
});

describe('SettingsView', () => {
  it('shows loading state when hooks are loading', () => {
    mockTutorProfile.isLoading = true;
    render(<SettingsView />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows profile info (name and email)', () => {
    render(<SettingsView />);
    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('test@example.com')).toBeDefined();
  });

  it('shows LanguageBadge with marking language', () => {
    render(<SettingsView />);
    expect(screen.getByText('sinhala')).toBeDefined();
  });

  it('shows subject badges for each subject', () => {
    render(<SettingsView />);
    expect(screen.getByText('Physics')).toBeDefined();
    expect(screen.getByText('Chemistry')).toBeDefined();
  });

  it('shows billing section with PlanBadge', () => {
    render(<SettingsView />);
    expect(screen.getByText('Billing')).toBeDefined();
    expect(screen.getByText('starter')).toBeDefined();
  });

  it('shows Manage Billing button', () => {
    render(<SettingsView />);
    expect(screen.getByText('Manage Billing')).toBeDefined();
  });

  it('shows Upgrade Plan link when isFree', () => {
    mockSubscription.isFree = true;
    render(<SettingsView />);
    expect(screen.getByText('Upgrade Plan')).toBeDefined();
  });

  it('does not show Upgrade Plan link when not free', () => {
    mockSubscription.isFree = false;
    render(<SettingsView />);
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
    expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeDefined();
  });

  it('switches to edit mode when Edit Profile clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByLabelText('Full Name')).toBeDefined();
    expect(screen.getByLabelText('Marking Language')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('pre-fills form with current values in edit mode', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
    expect(nameInput.value).toBe('John Doe');

    const languageSelect = screen.getByLabelText('Marking Language') as HTMLSelectElement;
    expect(languageSelect.value).toBe('sinhala');

    // The tutor's subjects (Physics, Chemistry) should be selected (have the active class)
    const physicsButton = screen.getByRole('button', { name: 'Physics' });
    expect(physicsButton.className).toContain('bg-primary');
    const chemistryButton = screen.getByRole('button', { name: 'Chemistry' });
    expect(chemistryButton.className).toContain('bg-primary');
  });

  it('shows all subjects in edit mode checkbox grid', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    expect(screen.getByRole('button', { name: 'Physics' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Chemistry' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Biology' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Combined Maths' })).toBeDefined();
  });

  it('hides Edit Profile button in edit mode', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).toBeNull();
  });

  it('returns to view mode when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    // Verify we are in edit mode
    expect(screen.getByLabelText('Full Name')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Should be back in view mode
    expect(screen.queryByLabelText('Full Name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeDefined();
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('calls PATCH and mutates on save', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    const mockApiFetch = vi.mocked(apiFetch);
    mockApiFetch.mockResolvedValueOnce({});

    const user = userEvent.setup();
    render(<SettingsView />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    // Modify the name
    const nameInput = screen.getByLabelText('Full Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/tutor/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: 'Jane Smith',
          marking_language: 'sinhala',
          subject_ids: ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02'],
        }),
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
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });

    // Should still be in edit mode
    expect(screen.getByLabelText('Full Name')).toBeDefined();
  });
});
