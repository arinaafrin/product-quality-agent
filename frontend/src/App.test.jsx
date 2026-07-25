import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

vi.mock('./api.js', () => ({
  getRules: vi.fn().mockResolvedValue([]),
  validateFeed: vi.fn(),
  askAgent: vi.fn(),
}));

describe('App', () => {
  test('shows the feed dashboard by default and switches to the rules view on nav click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/feed manifest/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rules' }));
    expect(screen.getByRole('heading', { name: /validation rules/i })).toBeInTheDocument();
  });

  test('opens the agent chat drawer from the toggle button', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /ask the agent/i }));
    expect(screen.getByRole('heading', { name: /ask the agent/i })).toBeInTheDocument();
  });
});
