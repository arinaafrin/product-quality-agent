#!/usr/bin/env node
/**
 * mcp_server.js
 * -------------
 * Exposes the product-feed quality engine and knowledge base as MCP tools
 * over stdio, so any MCP client (Claude Desktop, Claude Code, a custom
 * agent) can call this project directly — not just the bundled agent.js.
 *
 * Run standalone:
 *   node src/mcp_server.js
 *
 * Point an MCP client at it, e.g. in Claude Desktop's config:
 *   { "mcpServers": { "product-quality": { "command": "node", "args": ["src/mcp_server.js"] } } }
 */
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { validateFeed, getRuleDocs } = require('./quality_engine');
const { ragStore } = require('./rag_store');

const server = new Server(
  { name: 'product-quality-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'validate_feed',
    description:
      'Validate an array of product feed records against all quality rules. ' +
      'Returns a summary plus per-record pass/reject status and failure reasons. ' +
      'Also ingests the run into the knowledge base so it can be asked about later.',
    inputSchema: {
      type: 'object',
      properties: {
        records: {
          type: 'array',
          description: 'Array of product records (sku, title, price, currency, category, imageUrl).',
          items: { type: 'object' },
        },
      },
      required: ['records'],
    },
  },
  {
    name: 'search_knowledge_base',
    description:
      'Search the validation rules documentation and past validation run logs for context ' +
      'relevant to a question, e.g. "why does invalid currency get rejected" or ' +
      '"what failed in the last run".',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language question or keywords.' },
        k: { type: 'number', description: 'Number of results to return (default 4).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_rule_docs',
    description: 'List every validation rule with its id, severity, and human-readable description.',
    inputSchema: { type: 'object', properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'validate_feed') {
    const summary = validateFeed(args.records || []);
    ragStore.ingestValidationRun(summary);
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  }

  if (name === 'search_knowledge_base') {
    const results = ragStore.search(args.query, args.k || 4);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }

  if (name === 'get_rule_docs') {
    return { content: [{ type: 'text', text: JSON.stringify(getRuleDocs(), null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('product-quality-agent MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
