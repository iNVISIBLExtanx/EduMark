import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeModal } from '@/components/billing/UpgradeModal';

describe('UpgradeModal', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(<UpgradeModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content when isOpen is true', () => {
    render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Upgrade Your Plan')).toBeDefined();
    expect(screen.getByText(/used all your AI minutes/)).toBeDefined();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<UpgradeModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders View Plans link pointing to /pricing', () => {
    render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);
    const link = screen.getByText('View Plans');
    expect(link.getAttribute('href')).toBe('/pricing');
  });

  it('renders overlay backdrop', () => {
    const { container } = render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeDefined();
    expect(overlay).not.toBeNull();
  });
});
