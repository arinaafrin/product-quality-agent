import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import * as api from './api.js';

vi.mock('./api.js', () => ({
  getRules: vi.fn().mockResolvedValue([]),
  validateFeed: vi.fn(),
  askAgent: vi.fn(),
  isAuthenticated: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

describe('App (authenticated)', () => {
  beforeEach(() => {
    vi.mocked(api.isAuthenticated).mockReturnValue(true);
  });

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

  test('signing out returns to the login gate', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(api.logout).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/api key/i)).toBeInTheDocument();
  });
});

describe('App (unauthenticated)', () => {
  beforeEach(() => {
    vi.mocked(api.isAuthenticated).mockReturnValue(false);
  });

  test('shows the login gate instead of the dashboard', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/api key/i)).toBeInTheDocument();
    expect(screen.queryByText(/feed manifest/i)).not.toBeInTheDocument();
  });

  test('successful login reveals the dashboard', async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({ token: 'fake-token' });
    render(<App />);

    await user.type(screen.getByPlaceholderText(/api key/i), 'sk_demo_test');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(api.login).toHaveBeenCalledWith('sk_demo_test');
    expect(await screen.findByText(/feed manifest/i)).toBeInTheDocument();
  });

  test('failed login shows an error and stays on the login gate', async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(new Error('Invalid API key.'));
    render(<App />);

    await user.type(screen.getByPlaceholderText(/api key/i), 'wrong-key');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid api key/i);
  });
});
