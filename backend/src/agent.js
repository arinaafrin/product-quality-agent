/**
 * agent.js
 * --------
 * The chat-facing agent used by the backend API (POST /api/ask).
 *
 * Default mode — no API key required: retrieves from the RAG store
 * (ragStore.search) and composes a grounded answer directly from the
 * retrieved chunks, with no LLM call at all. This is deliberately simple
 * and fully offline, matching the same "no external dependency" approach
 * as rag_store.js — it always works, with zero configuration.
 *
 * Optional upgrade — set ANTHROPIC_API_KEY: the agent switches to a real
 * tool-use loop against the Anthropic Messages API for more natural,
 * synthesized answers, while still grounding every answer in the same
 * search_knowledge_base tool. If the API call fails for any reason (bad
 * key, network, rate limit), it falls back to the offline synthesis
 * rather than erroring out.
 */
const { ragStore } = require('./rag_store');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are the Product Quality Agent for an e-commerce product feed pipeline.
You answer questions about why product records were rejected or flagged, and about the
validation rules themselves. Always ground your answers in the tool results you retrieve —
call search_knowledge_base before answering anything specific about rules or past runs.
If the knowledge base has no relevant information, say so plainly instead of guessing.
Keep answers concise and concrete: cite rule ids and SKUs when relevant.`;

const TOOLS = [
  {
    name: 'search_knowledge_base',
    description:
      'Search validation rule docs and past validation run logs for information relevant ' +
      'to the user question. Always call this before answering a specific question.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language question or keywords' },
      },
      required: ['query'],
    },
  },
];

function runTool(name, input) {
  if (name === 'search_knowledge_base') {
    return ragStore.search(input.query, 5);
  }
  throw new Error(`Unknown tool: ${name}`);
}

/** Turn one retrieved chunk into a plain sentence, stripping markdown syntax. */
function cleanChunk(text) {
  return text
    .replace(/^##\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic, keyless answer synthesis: no LLM, just the top retrieved
 * chunks stitched into a readable answer with their source labeled.
 */
function synthesizeOffline(results) {
  if (results.length === 0) {
    return (
      "I couldn't find anything in the validation rules or past run logs that answers that. " +
      'Try asking about a specific rule id (e.g. "invalid-price"), a SKU, or "what failed in the last run".'
    );
  }
  return results
    .slice(0, 3)
    .map((r) => {
      const label = r.type === 'validation_log' ? 'From the validation run log' : `From ${r.source}`;
      return `${label}: ${cleanChunk(r.text)}`;
    })
    .join('\n\n');
}

async function askOffline(question) {
  const results = ragStore.search(question, 5);
  return {
    answer: synthesizeOffline(results),
    toolCalls: [{ name: 'search_knowledge_base', input: { query: question }, result: results }],
    mode: 'offline',
  };
}

async function askWithLLM(question) {
  // Lazy-required so the SDK is only touched when a key is actually configured.
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();

  const messages = [{ role: 'user', content: question }];
  const toolCalls = [];

  for (let turn = 0; turn < 4; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      const answer = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return { answer, toolCalls, mode: 'llm' };
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = toolUseBlocks.map((block) => {
      const result = runTool(block.name, block.input);
      toolCalls.push({ name: block.name, input: block.input, result });
      return {
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      };
    });

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    answer: 'I was not able to reach a grounded answer within the tool-call limit.',
    toolCalls,
    mode: 'llm',
  };
}

/**
 * Ask the agent a question. Uses the LLM tool-use loop if ANTHROPIC_API_KEY
 * is set (falling back to offline synthesis on any error), otherwise goes
 * straight to offline synthesis.
 * @param {string} question
 * @returns {Promise<{answer: string, toolCalls: Array, mode: 'offline'|'llm'}>}
 */
async function ask(question) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await askWithLLM(question);
    } catch (err) {
      console.error('LLM agent call failed, falling back to offline synthesis:', err.message);
      return askOffline(question);
    }
  }
  return askOffline(question);
}

module.exports = { ask };
