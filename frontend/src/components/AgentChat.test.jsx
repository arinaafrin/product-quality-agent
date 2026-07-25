import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentChat from './AgentChat.jsx';
import { askAgent } from '../api.js';

vi.mock('../api.js', () => ({
  askAgent: vi.fn(),
}));

describe('AgentChat', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('shows the empty-state hint when there are no messages yet', () => {
    render(<AgentChat open onClose={() => {}} />);
    expect(screen.getByText(/why did today.s import reject records/i)).toBeInTheDocument();
  });

  test('sends a question and renders both the user message and the agent answer', async () => {
    askAgent.mockResolvedValue({ answer: 'Because it is not supported.', mode: 'offline', toolCalls: [] });
    const user = userEvent.setup();

    render(<AgentChat open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/question for the agent/i), 'why invalid currency?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('why invalid currency?')).toBeInTheDocument();
    expect(await screen.findByText('Because it is not supported.')).toBeInTheDocument();
    expect(askAgent).toHaveBeenCalledWith('why invalid currency?');
  });

  test('shows an error bubble if the agent call fails', async () => {
    askAgent.mockRejectedValue(new Error('The agent failed to respond.'));
    const user = userEvent.setup();

    render(<AgentChat open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/question for the agent/i), 'anything');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('The agent failed to respond.')).toBeInTheDocument();
  });

  test('the send button is disabled for whitespace-only input and no request is made', async () => {
    const user = userEvent.setup();
    render(<AgentChat open onClose={() => {}} />);

    await user.type(screen.getByLabelText(/question for the agent/i), '   ');
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    expect(askAgent).not.toHaveBeenCalled();
  });

  test('pressing Enter sends the message', async () => {
    askAgent.mockResolvedValue({ answer: 'ok', mode: 'offline', toolCalls: [] });
    const user = userEvent.setup();

    render(<AgentChat open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/question for the agent/i), 'hello{Enter}');

    expect(await screen.findByText('ok')).toBeInTheDocument();
  });

  test('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AgentChat open onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close chat/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
