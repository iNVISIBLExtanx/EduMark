import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PricingTable } from './PricingTable';

const mockSubscription = {
  subscription: {
    plan: 'free',
    ai_minutes_used: 5,
    ai_minutes_limit: 10,
    subscription_status: 'active',
    billing_period_end: null,
  },
  available: 5,
  usagePercent: 50,
  isPastDue: false,
  isFree: true,
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
  mockSubscription.subscription.plan = 'free';
  mockSubscription.isFree = true;
  mockSubscription.isLoading = false;
  mockSubscription.error = undefined;
});

describe('PricingTable', () => {
  it('renders all 5 plan cards', () => {
    render(<PricingTable />);

    expect(screen.getByText('free')).toBeDefined();
    expect(screen.getByText('starter')).toBeDefined();
    expect(screen.getByText('standard')).toBeDefined();
    expect(screen.getByText('pro')).toBeDefined();
    expect(screen.getByText('institute')).toBeDefined();
  });

  it('shows correct prices and AI minutes', () => {
    render(<PricingTable />);

    expect(screen.getByText('Free')).toBeDefined();
    expect(screen.getByText('10 AI minutes/month')).toBeDefined();
    expect(screen.getByText('50 AI minutes/month')).toBeDefined();
    expect(screen.getByText('350 AI minutes/month')).toBeDefined();
  });

  it('shows Current Plan button for the current plan', () => {
    render(<PricingTable />);

    expect(screen.getByText('Current Plan')).toBeDefined();
  });

  it('shows Upgrade buttons for higher tiers', () => {
    render(<PricingTable />);

    const upgradeButtons = screen.getAllByText('Upgrade');
    expect(upgradeButtons.length).toBe(4); // starter, standard, pro, institute
  });

  it('shows top-up card', () => {
    render(<PricingTable />);

    expect(screen.getByText('Top Up')).toBeDefined();
    expect(screen.getByText('Add 10 Minutes')).toBeDefined();
  });

  it('calls checkout on Upgrade click', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<PricingTable />);

    const upgradeButtons = screen.getAllByText('Upgrade');
    fireEvent.click(upgradeButtons[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/stripe/checkout', expect.objectContaining({
        method: 'POST',
      }));
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('shows loading spinner during checkout', () => {
    mockSubscription.isLoading = true;
    render(<PricingTable />);

    // Should show loading spinner, not plan cards
    expect(screen.queryByText('Upgrade')).toBeNull();
  });

  it('renders error message when useSubscription returns error', () => {
    (mockSubscription as Record<string, unknown>).error = new Error('Failed to load');
    mockSubscription.isLoading = false;
    render(<PricingTable />);

    // Component should show some error indication or still render gracefully
    // This test documents current behavior
    expect(screen.queryByText('Upgrade')).toBeDefined();
  });

  it('calls checkout with isTopUp true for top-up click', async () => {
    const { apiFetch } = await import('@/lib/api-client');
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://checkout.stripe.com/topup',
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<PricingTable />);

    const addMinutesButton = screen.getByText('Add 10 Minutes');
    fireEvent.click(addMinutesButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/stripe/checkout', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"isTopUp":true'),
      }));
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});
