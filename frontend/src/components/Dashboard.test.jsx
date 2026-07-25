import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard.jsx';
import { validateFeed } from '../api.js';

vi.mock('../api.js', () => ({
  validateFeed: vi.fn(),
}));

function makeJsonFile(name, data) {
  return new File([JSON.stringify(data)], name, { type: 'application/json' });
}

describe('Dashboard', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('shows the empty state before any feed has been uploaded', () => {
    render(<Dashboard />);
    expect(screen.getByText(/no feed validated yet/i)).toBeInTheDocument();
  });

  test('uploads a JSON feed and renders the returned summary stats', async () => {
    validateFeed.mockResolvedValue({
      total: 2,
      passed: 1,
      rejected: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      results: [
        { index: 0, sku: 'A', title: 'A', status: 'passed', failures: [] },
        {
          index: 1,
          sku: 'B',
          title: 'B',
          status: 'rejected',
          failures: [{ ruleId: 'invalid-price', severity: 'error', message: 'Price is missing.' }],
        },
      ],
    });
    const user = userEvent.setup();
    render(<Dashboard />);

    const file = makeJsonFile('feed.json', [{ sku: 'A' }, { sku: 'B' }]);
    await user.upload(screen.getByLabelText(/upload feed/i), file);

    await waitFor(() => expect(validateFeed).toHaveBeenCalledWith([{ sku: 'A' }, { sku: 'B' }]));
    expect(await screen.findByText('feed.json')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/manifest — run at/i)).toBeInTheDocument();
  });

  test('shows an inline error if the uploaded file is not valid JSON', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    const badFile = new File(['not json'], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/upload feed/i), badFile);

    expect(await screen.findByText(/valid json/i)).toBeInTheDocument();
    expect(validateFeed).not.toHaveBeenCalled();
  });

  test('shows the API-provided error message when validation fails server-side', async () => {
    validateFeed.mockRejectedValue(new Error('Request body must be { "records": [...] }'));
    const user = userEvent.setup();
    render(<Dashboard />);

    const file = makeJsonFile('feed.json', [{ sku: 'A' }]);
    await user.upload(screen.getByLabelText(/upload feed/i), file);

    expect(await screen.findByText('Request body must be { "records": [...] }')).toBeInTheDocument();
  });

  test('accepts a { records: [...] } wrapper object as well as a bare array', async () => {
    validateFeed.mockResolvedValue({
      total: 1,
      passed: 1,
      rejected: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      results: [],
    });
    const user = userEvent.setup();
    render(<Dashboard />);

    const file = makeJsonFile('feed.json', { records: [{ sku: 'A' }] });
    await user.upload(screen.getByLabelText(/upload feed/i), file);

    await waitFor(() => expect(validateFeed).toHaveBeenCalledWith([{ sku: 'A' }]));
  });
});
