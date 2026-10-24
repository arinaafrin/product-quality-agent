const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description:
        "Search validation rule docs and past validation run logs for information relevant " +
        "to the user question. Always call this before answering a specific question.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language question or keywords",
          },
        },
        required: ["query"],
      },
    },
  },
];

function createClient() {
  // Lazy require, like the Anthropic SDK in agent.js.
  const { AzureOpenAI } = require("openai");
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
  });
}

async function askAzureOpenAI({
  question,
  systemPrompt,
  runTool,
  client = createClient(),
}) {
  const model = process.env.AZURE_OPENAI_DEPLOYMENT;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];
  const toolCalls = [];

  for (let turn = 0; turn < 4; turn++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      max_tokens: 1024,
    });
    const message = response.choices[0].message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        answer: message.content || "",
        toolCalls,
        mode: "llm",
        provider: "azure-openai",
      };
    }

    messages.push(message);
    for (const call of message.tool_calls) {
      const input = JSON.parse(call.function.arguments);
      const result = runTool(call.function.name, input);
      toolCalls.push({ name: call.function.name, input, result });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    answer:
      "I was not able to reach a grounded answer within the tool-call limit.",
    toolCalls,
    mode: "llm",
    provider: "azure-openai",
  };
}

module.exports = { askAzureOpenAI };
