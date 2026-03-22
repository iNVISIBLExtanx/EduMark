import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BatchStatusBadge } from '@/components/batches/BatchStatusBadge';

describe('BatchStatusBadge', () => {
  it('renders "pending" with gray styling', () => {
    render(<BatchStatusBadge status="pending" />);
    const badge = screen.getByText('pending');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-700');
  });

  it('renders "uploading" with blue styling', () => {
    render(<BatchStatusBadge status="uploading" />);
    const badge = screen.getByText('uploading');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-700');
  });

  it('renders "processing" with blue styling', () => {
    render(<BatchStatusBadge status="processing" />);
    const badge = screen.getByText('processing');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-700');
  });

  it('renders "completed" with green styling', () => {
    render(<BatchStatusBadge status="completed" />);
    const badge = screen.getByText('completed');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-700');
  });

  it('renders "failed" with red styling', () => {
    render(<BatchStatusBadge status="failed" />);
    const badge = screen.getByText('failed');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-700');
  });

  it('falls back to pending styles for unknown status', () => {
    render(<BatchStatusBadge status="unknown" />);
    const badge = screen.getByText('unknown');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-700');
  });

  it('includes base badge classes', () => {
    render(<BatchStatusBadge status="pending" />);
    const badge = screen.getByText('pending');
    expect(badge.className).toContain('inline-flex');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('font-medium');
  });
});
