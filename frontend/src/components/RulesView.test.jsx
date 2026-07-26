import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RulesView from './RulesView.jsx';
import { getRules } from '../api.js';

vi.mock('../api.js', () => ({
  getRules: vi.fn(),
}));

describe('RulesView', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('loads and renders rules from the API on mount', async () => {
    getRules.mockResolvedValue([
      { id: 'invalid-price', severity: 'error', description: 'Price must be positive.' },
    ]);

    render(<RulesView />);

    await waitFor(() => expect(screen.getByText('invalid-price')).toBeInTheDocument());
    expect(screen.getByText('Price must be positive.')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  test('shows an error message if fetching rules fails', async () => {
    getRules.mockRejectedValue(new Error('network down'));

    render(<RulesView />);

    await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument());
  });
});
