import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ManifestStrip from './ManifestStrip.jsx';

describe('ManifestStrip', () => {
  test('shows an empty message when there are no results', () => {
    render(<ManifestStrip results={[]} />);
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });

  test('renders one tick per result with a status class and a descriptive tooltip', () => {
    const results = [
      { index: 0, sku: 'FDS-1', status: 'passed', failures: [] },
      {
        index: 1,
        sku: 'FDS-2',
        status: 'rejected',
        failures: [{ ruleId: 'invalid-price', message: 'Price is missing.' }],
      },
    ];
    render(<ManifestStrip results={results} />);

    const ticks = screen.getAllByRole('listitem');
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toHaveClass('manifest-tick', 'passed');
    expect(ticks[0]).toHaveAttribute('title', 'FDS-1: passed');
    expect(ticks[1]).toHaveClass('manifest-tick', 'rejected');
    expect(ticks[1]).toHaveAttribute('title', 'FDS-2: Price is missing.');
  });

  test('falls back to "record N" in the tooltip when a SKU is missing', () => {
    render(<ManifestStrip results={[{ index: 3, sku: null, status: 'passed', failures: [] }]} />);
    expect(screen.getByRole('listitem')).toHaveAttribute('title', 'record 3: passed');
  });
});
