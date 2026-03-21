import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiMinutesBar } from './AiMinutesBar';

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

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscription.available = 40;
  mockSubscription.usagePercent = 20;
  mockSubscription.isPastDue = false;
  mockSubscription.subscription.subscription_status = 'active';
});

describe('AiMinutesBar', () => {
  it('renders remaining minutes', () => {
    render(<AiMinutesBar />);
    expect(screen.getByText('40 remaining / 50')).toBeDefined();
  });

  it('shows green bar when usage is low', () => {
    mockSubscription.usagePercent = 50;
    const { container } = render(<AiMinutesBar />);
    const bar = container.querySelector('.bg-green-500');
    expect(bar).toBeDefined();
  });

  it('shows yellow bar when usage is 70-90%', () => {
    mockSubscription.usagePercent = 80;
    const { container } = render(<AiMinutesBar />);
    const bar = container.querySelector('.bg-yellow-500');
    expect(bar).toBeDefined();
  });

  it('shows red bar when usage exceeds 90%', () => {
    mockSubscription.usagePercent = 95;
    const { container } = render(<AiMinutesBar />);
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeDefined();
  });

  it('shows Update Payment button when past_due', () => {
    mockSubscription.isPastDue = true;
    render(<AiMinutesBar />);

    expect(screen.getByText('Update Payment')).toBeDefined();
    expect(screen.getByText(/Payment failed/)).toBeDefined();
  });

  it('calls portal endpoint on Update Payment click', async () => {
    mockSubscription.isPastDue = true;

    const { apiFetch } = await import('@/lib/api-client');
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://billing.stripe.com/portal',
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<AiMinutesBar />);
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

  it('shows low balance warning with Top Up link when available < 10', () => {
    mockSubscription.available = 5;
    mockSubscription.isPastDue = false;
    render(<AiMinutesBar />);

    expect(screen.getByText(/Running low/)).toBeDefined();
    expect(screen.getByText('Top Up')).toBeDefined();
  });

  it('does not show warnings when balance is sufficient', () => {
    mockSubscription.available = 40;
    mockSubscription.isPastDue = false;
    render(<AiMinutesBar />);

    expect(screen.queryByText(/Running low/)).toBeNull();
    expect(screen.queryByText('Update Payment')).toBeNull();
  });
});
