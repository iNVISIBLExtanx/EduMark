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
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
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
  { id: 'b1', name: 'Batch 1', status: 'completed', medium: 'english', total_papers: 10, marked_papers: 10, created_at: '2026-04-20' },
  { id: 'b2', name: 'Batch 2', status: 'processing', medium: 'sinhala', total_papers: 5, marked_papers: 2, created_at: '2026-04-21' },
  { id: 'b3', name: 'Batch 3', status: 'pending', medium: 'tamil', total_papers: 8, marked_papers: 0, created_at: '2026-04-22' },
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
  it('shows loading state (Skeleton) when hooks are loading', () => {
    mockUseTutorProfile.mockReturnValue({ ...defaultTutor, isLoading: true });
    const { container } = render(<DashboardHome />);
    // Loading state renders Skeleton components, not "Loading..." text
    // Verify the main content (greeting, batches table) is NOT shown
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows loading state when subscription is loading', () => {
    mockUseSubscription.mockReturnValue({ ...defaultSubscription, isLoading: true });
    const { container } = render(<DashboardHome />);
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows loading state when batches are loading', () => {
    mockUseBatches.mockReturnValue({ ...defaultBatches, isLoading: true });
    const { container } = render(<DashboardHome />);
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows greeting with tutor name', () => {
    render(<DashboardHome />);
    // Greeting is "{Good morning/afternoon/evening}, Jane Doe"
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it('shows capitalized plan badge', () => {
    render(<DashboardHome />);
    // Plan badge shows "Starter" (capitalized), not "starter"
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });

  it('shows recent batches list', () => {
    render(<DashboardHome />);
    expect(screen.getByText('Batch 1')).toBeInTheDocument();
    expect(screen.getByText('Batch 2')).toBeInTheDocument();
    expect(screen.getByText('Batch 3')).toBeInTheDocument();
    // Papers column shows "marked/total" without the word "papers"
    expect(screen.getByText('10/10')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByText('0/8')).toBeInTheDocument();
    // Status badges
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows empty state when no batches', () => {
    mockUseBatches.mockReturnValue({ ...defaultBatches, batches: [] });
    render(<DashboardHome />);
    expect(screen.getByText('No batches yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first batch to start marking')).toBeInTheDocument();
  });

  it('shows upgrade nudge card when plan is free and minutes < 5', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 0,
      isFree: true,
      subscription: { plan: 'free', ai_minutes_used: 10, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
    });
    render(<DashboardHome />);
    // Component shows an upgrade nudge card (not an UpgradeModal)
    expect(screen.getByText('Running low on AI Minutes')).toBeInTheDocument();
    expect(screen.getByText('Upgrade Now')).toBeInTheDocument();
  });

  it('does NOT show upgrade nudge when available >= 5', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 40,
      isFree: true,
      subscription: { plan: 'free', ai_minutes_used: 0, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
    });
    render(<DashboardHome />);
    expect(screen.queryByText('Running low on AI Minutes')).not.toBeInTheDocument();
  });

  it('does NOT show upgrade nudge when not free plan', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 0,
      isFree: false,
      subscription: { plan: 'starter', ai_minutes_used: 50, ai_minutes_limit: 50, subscription_status: 'active', billing_period_end: null },
    });
    render(<DashboardHome />);
    expect(screen.queryByText('Running low on AI Minutes')).not.toBeInTheDocument();
  });

  it('shows past due banner when subscription is past_due', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      subscription: { plan: 'starter', ai_minutes_used: 10, ai_minutes_limit: 50, subscription_status: 'past_due', billing_period_end: null },
    });
    render(<DashboardHome />);
    expect(screen.getByText(/Payment failed/)).toBeInTheDocument();
    expect(screen.getByText('Update Billing')).toBeInTheDocument();
  });

  it('shows "View All Batches" button', () => {
    render(<DashboardHome />);
    expect(screen.getByText('View All Batches')).toBeInTheDocument();
  });

  it('shows AI Minutes Remaining card with correct value', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      subscription: { plan: 'starter', ai_minutes_used: 10, ai_minutes_limit: 50, subscription_status: 'active', billing_period_end: null },
    });
    render(<DashboardHome />);
    expect(screen.getByText('AI Minutes Remaining')).toBeInTheDocument();
    // 50 - 10 = 40 remaining
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('shows Papers Marked card with correct total', () => {
    render(<DashboardHome />);
    // Batch 1: 10 marked, Batch 2: 2 marked, Batch 3: 0 = total 12
    expect(screen.getByText('Papers Marked')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows Batches This Month card', () => {
    render(<DashboardHome />);
    expect(screen.getByText('Batches This Month')).toBeInTheDocument();
    // 3 sample batches
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows Recent Batches section header', () => {
    render(<DashboardHome />);
    expect(screen.getByText('Recent Batches')).toBeInTheDocument();
  });

  it('shows subject column with dash when subject_name is null', () => {
    render(<DashboardHome />);
    // All sample batches have subject_name: null (from hook mapping), rendered as "—"
    const dashCells = screen.getAllByText('—');
    expect(dashCells.length).toBeGreaterThan(0);
  });

  it('shows upgrade nudge when available < 5 and isFree', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 3,
      isFree: true,
      subscription: { plan: 'free', ai_minutes_used: 7, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
    });
    render(<DashboardHome />);
    expect(screen.getByText('Running low on AI Minutes')).toBeInTheDocument();
  });

  it('does NOT show upgrade nudge when available >= 5 and isFree', () => {
    mockUseSubscription.mockReturnValue({
      ...defaultSubscription,
      available: 5,
      isFree: true,
      subscription: { plan: 'free', ai_minutes_used: 5, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
    });
    render(<DashboardHome />);
    expect(screen.queryByText('Running low on AI Minutes')).not.toBeInTheDocument();
  });
});
