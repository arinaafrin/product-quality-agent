// Covers the ANTHROPIC_API_KEY branch of agent.js: the tool-use loop against
// the Anthropic SDK, the turn-limit fallback, and falling back to offline
// synthesis whenever the LLM call (or an unexpected tool name) fails.
//
// @anthropic-ai/sdk is mocked as a virtual module so these tests run
// whether or not the real package is installed.
jest.mock('@anthropic-ai/sdk', () => jest.fn(), { virtual: true });

const Anthropic = require('@anthropic-ai/sdk');
const { ask } = require('../src/agent');

describe('agent.ask (LLM mode, ANTHROPIC_API_KEY set)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    Anthropic.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  afterAll(() => {
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test('returns a direct text answer when the model needs no tool call', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Direct answer.' }],
    });
    Anthropic.mockImplementation(() => ({ messages: { create } }));

    const result = await ask('what is rule invalid-price?');

    expect(result.mode).toBe('llm');
    expect(result.answer).toBe('Direct answer.');
    expect(result.toolCalls).toHaveLength(0);
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('runs the tool-use loop: calls search_knowledge_base then returns the grounded answer', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'call_1', name: 'search_knowledge_base', input: { query: 'currency' } },
        ],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Grounded final answer.' }],
      });
    Anthropic.mockImplementation(() => ({ messages: { create } }));

    const result = await ask('why does invalid currency get rejected?');

    expect(result.mode).toBe('llm');
    expect(result.answer).toBe('Grounded final answer.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search_knowledge_base');
    expect(result.toolCalls[0].result).toBeDefined();
    expect(create).toHaveBeenCalledTimes(2);
  });

  test('stops after the turn limit and returns a not-grounded message if the model keeps calling tools', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'call_x', name: 'search_knowledge_base', input: { query: 'x' } }],
    });
    Anthropic.mockImplementation(() => ({ messages: { create } }));

    const result = await ask('endless question');

    expect(result.mode).toBe('llm');
    expect(result.answer).toMatch(/tool-call limit/);
    expect(create).toHaveBeenCalledTimes(4);
  });

  test('falls back to offline synthesis if the LLM call throws', async () => {
    const create = jest.fn().mockRejectedValue(new Error('network down'));
    Anthropic.mockImplementation(() => ({ messages: { create } }));

    const result = await ask('why does invalid currency get rejected?');

    expect(result.mode).toBe('offline');
    expect(result.answer.toLowerCase()).toContain('currency');
  });

  test('falls back to offline synthesis if the model calls an unrecognized tool', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'call_bad', name: 'not_a_real_tool', input: {} }],
    });
    Anthropic.mockImplementation(() => ({ messages: { create } }));

    const result = await ask('anything');

    expect(result.mode).toBe('offline');
  });
});
