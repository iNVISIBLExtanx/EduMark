import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlanBadge } from './PlanBadge';

describe('PlanBadge', () => {
  it('renders free plan with gray styling', () => {
    render(<PlanBadge plan="free" />);
    const badge = screen.getByText('free');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-700');
  });

  it('renders starter plan with blue styling', () => {
    render(<PlanBadge plan="starter" />);
    const badge = screen.getByText('starter');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-700');
  });

  it('renders standard plan with indigo styling', () => {
    render(<PlanBadge plan="standard" />);
    const badge = screen.getByText('standard');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-indigo-100');
    expect(badge.className).toContain('text-indigo-700');
  });

  it('renders pro plan with purple styling', () => {
    render(<PlanBadge plan="pro" />);
    const badge = screen.getByText('pro');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-purple-100');
    expect(badge.className).toContain('text-purple-700');
  });

  it('renders institute plan with amber styling', () => {
    render(<PlanBadge plan="institute" />);
    const badge = screen.getByText('institute');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-amber-100');
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders unknown plan with free (gray) styling as fallback', () => {
    render(<PlanBadge plan="unknown" />);
    const badge = screen.getByText('unknown');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-700');
  });

  it('includes capitalize class for display formatting', () => {
    render(<PlanBadge plan="starter" />);
    const badge = screen.getByText('starter');
    expect(badge.className).toContain('capitalize');
  });

  it('includes base badge classes', () => {
    render(<PlanBadge plan="free" />);
    const badge = screen.getByText('free');
    expect(badge.className).toContain('inline-flex');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('font-medium');
  });
});
