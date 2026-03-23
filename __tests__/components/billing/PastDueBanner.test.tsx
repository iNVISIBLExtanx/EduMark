import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PastDueBanner } from '@/components/billing/PastDueBanner';

const mockSubscription = {
  subscription: {
    plan: 'starter',
    ai_minutes_used: 10,
    ai_minutes_limit: 50,
    subscription_status: 'past_due',
    billing_period_end: '2026-04-19T00:00:00Z',
  },
  available: 40,
  usagePercent: 20,
  isPastDue: true,
  isFree: false,
  isLoading: false,
  error: undefined,
  mutate: vi.fn(),
};

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscription.isPastDue = true;
  mockSubscription.isLoading = false;
});

describe('PastDueBanner', () => {
  it('returns null when isLoading is true', () => {
    mockSubscription.isLoading = true;
    mockSubscription.isPastDue = true;
    const { container } = render(<PastDueBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when not past due', () => {
    mockSubscription.isPastDue = false;
    const { container } = render(<PastDueBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders warning text when past due', () => {
    render(<PastDueBanner />);
    expect(screen.getByText(/Payment failed/)).toBeDefined();
    expect(screen.getByText('Update Payment')).toBeDefined();
  });

  it('shows Redirecting... while portal is loading', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    (apiFetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {})); // never resolves

    render(<PastDueBanner />);
    fireEvent.click(screen.getByText('Update Payment'));

    await waitFor(() => {
      expect(screen.getByText('Redirecting...')).toBeDefined();
    });
  });

  it('calls portal endpoint on Update Payment click', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://billing.stripe.com/portal',
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<PastDueBanner />);
    fireEvent.click(screen.getByText('Update Payment'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/stripe/portal', expect.objectContaining({
        method: 'POST',
      }));
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('resets loading state when portal call fails', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Portal error'));

    render(<PastDueBanner />);
    fireEvent.click(screen.getByText('Update Payment'));

    await waitFor(() => {
      expect(screen.getByText('Update Payment')).toBeDefined();
    });
  });
});
