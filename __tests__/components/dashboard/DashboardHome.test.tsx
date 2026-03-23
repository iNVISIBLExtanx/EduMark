import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardHome } from '@/components/dashboard/DashboardHome';

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
}));
vi.mock('@/hooks/useTutorProfile', () => ({
  useTutorProfile: vi.fn(),
}));
vi.mock('@/hooks/useBatches', () => ({
  useBatches: vi.fn(),
}));
vi.mock('@/components/billing/AiMinutesBar', () => ({
  AiMinutesBar: () => <div data-testid="ai-minutes-bar" />,
}));
vi.mock('@/components/billing/UpgradeModal', () => ({
  UpgradeModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="upgrade-modal" /> : null,
}));

import { useSubscription } from '@/hooks/useSubscription';
import { useTutorProfile } from '@/hooks/useTutorProfile';
import { useBatches } from '@/hooks/useBatches';

const mockUseSubscription = useSubscription as ReturnType<typeof vi.fn>;
const mockUseTutorProfile = useTutorProfile as ReturnType<typeof vi.fn>;
const mockUseBatches = useBatches as ReturnType<typeof vi.fn>;

const defaultSubscription = {
  subscription: { plan: 'starter' },
  available: 40,
  isFree: false,
  isLoading: false,
  error: null,
  usagePercent: 20,
  isPastDue: false,
  mutate: vi.fn(),
};

const defaultTutor = {
  tutor: {
    id: 'tutor-1',
    email: 'tutor@example.com',
    full_name: 'Jane Doe',
    marking_language: 'english',
    plan: 'starter',
  },
  error: null,
  isLoading: false,
  mutate: vi.fn(),
};

const sampleBatches = [
  { id: 'b1', name: 'Batch 1', status: 'completed', medium: 'english', total_papers: 10, marked_papers: 10, created_at: '2026-03-20' },
  { id: 'b2', name: 'Batch 2', status: 'processing', medium: 'sinhala', total_papers: 5, marked_papers: 2, created_at: '2026-03-21' },
  { id: 'b3', name: 'Batch 3', status: 'pending', medium: 'tamil', total_papers: 8, marked_papers: 0, created_at: '2026-03-22' },
];

const defaultBatches = {
  batches: sampleBatches,
  error: null,
  isLoading: false,
  mutate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSubscription.mockReturnValue(defaultSubscription);
  mockUseTutorProfile.mockReturnValue(defaultTutor);
  mockUseBatches.mockReturnValue(defaultBatches);
});

describe('DashboardHome', () => {
  it('shows loading state when hooks are loading', () => {
    mockUseTutorProfile.mockReturnValue({ ...defaultTutor, isLoading: true });
    render(<DashboardHome />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows loading state when subscription is loading', () => {
    mockUseSubscription.mockReturnValue({ ...defaultSubscription, isLoading: true });
    render(<DashboardHome />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows loading state when batches are loading', () => {
    mockUseBatches.mockReturnValue({ ...defaultBatches, isLoading: true });
    render(<DashboardHome />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows greeting with tutor name', () => {
    render(<DashboardHome />);
    expect(screen.getByText('Welcome, Jane Doe')).toBeInTheDocument();
  });

  it('shows PlanBadge and LanguageBadge', () => {
    render(<DashboardHome />);
    expect(screen.getByText('starter')).toBeInTheDocument();
    expect(screen.getByText('english')).toBeInTheDocument();
  });

  it('shows recent batches list', () => {
    render(<DashboardHome />);
    expect(screen.getByText('Batch 1')).toBeInTheDocument();
    expect(screen.getByText('Batch 2')).toBeInTheDocument();
    expect(screen.getByText('Batch 3')).toBeInTheDocument();
    expect(screen.getByText('10/10 papers')).toBeInTheDocument();
    expect(screen.getByText('2/5 papers')).toBeInTheDocument();
    expect(screen.getByText('0/8 papers')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows empty state when no batches', () => {
    mockUseBatches.mockReturnValue({ ...defaultBatches, batches: [] });
    render(<DashboardHome />);
    expect(
      screen.getByText('No batches yet. Start by uploading a question paper.')
    ).toBeInTheDocument();
    expect(screen.getByText('Upload a question paper')).toHaveAttribute('href', '/papers');
  });

  it('shows UpgradeModal when available=0 and isFree=true', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 0,
      isFree: true,
      subscription: { plan: 'free' },
    });
    render(<DashboardHome />);
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
  });

  it('does NOT show UpgradeModal when available > 0', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 40,
      isFree: true,
      subscription: { plan: 'free' },
    });
    render(<DashboardHome />);
    expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
  });

  it('shows error when tutor hook has error', () => {
    mockUseTutorProfile.mockReturnValue({
      ...defaultTutor,
      error: new Error('Failed to load tutor'),
    });
    render(<DashboardHome />);
    expect(screen.getByText('Failed to load tutor')).toBeInTheDocument();
  });

  it('shows error when batches hook has error', () => {
    mockUseBatches.mockReturnValue({
      ...defaultBatches,
      error: new Error('Failed to load batches'),
    });
    render(<DashboardHome />);
    expect(screen.getByText('Failed to load batches')).toBeInTheDocument();
  });

  it('shows "View all batches" link when batches exist', () => {
    render(<DashboardHome />);
    const link = screen.getByText(/View all batches/);
    expect(link).toHaveAttribute('href', '/batches');
  });

  it('renders AiMinutesBar', () => {
    render(<DashboardHome />);
    expect(screen.getByTestId('ai-minutes-bar')).toBeInTheDocument();
  });

  it('shows quick stats card', () => {
    render(<DashboardHome />);
    expect(screen.getByTestId('quick-stats')).toBeInTheDocument();
  });

  it('shows total papers marked this month', () => {
    render(<DashboardHome />);
    // Batch 1: 10 marked, Batch 2: 2 marked, Batch 3: 0 marked = 12 total
    // All batches have March 2026 dates, matching the current test date
    expect(screen.getByTestId('stat-marked-month')).toHaveTextContent('12');
  });

  it('shows active batches count', () => {
    render(<DashboardHome />);
    // Batch 2 has status 'processing' = 1 active
    expect(screen.getByTestId('stat-active-batches')).toHaveTextContent('1');
  });

  it('shows completed batches count', () => {
    render(<DashboardHome />);
    // Batch 1 has status 'completed' = 1 completed
    expect(screen.getByTestId('stat-completed-batches')).toHaveTextContent('1');
  });

  it('shows 0 for stats when no batches in current month', () => {
    const oldBatches = [
      { id: 'b1', name: 'Old Batch 1', status: 'completed', medium: 'english', total_papers: 10, marked_papers: 10, created_at: '2025-01-15' },
      { id: 'b2', name: 'Old Batch 2', status: 'processing', medium: 'sinhala', total_papers: 5, marked_papers: 3, created_at: '2025-01-16' },
    ];
    mockUseBatches.mockReturnValue({ ...defaultBatches, batches: oldBatches });
    render(<DashboardHome />);
    expect(screen.getByTestId('stat-marked-month')).toHaveTextContent('0');
  });

  it('shows UpgradeModal when available < 5 and isFree', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 3,
      isFree: true,
      subscription: { plan: 'free' },
    });
    render(<DashboardHome />);
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
  });

  it('does NOT show UpgradeModal when available >= 5 and isFree', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 5,
      isFree: true,
      subscription: { plan: 'free' },
    });
    render(<DashboardHome />);
    expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
  });
});
