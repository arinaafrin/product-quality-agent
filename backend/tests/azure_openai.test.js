jest.mock("../src/providers/azure_openai");

const { askAzureOpenAI: realAsk } = jest.requireActual(
  "../src/providers/azure_openai",
);
const { askAzureOpenAI: mockedAsk } = require("../src/providers/azure_openai");
const { ask } = require("../src/agent");

describe("azure_openai provider (fake client, no network)", () => {
  test("calls the tool, then returns the final answer", async () => {
    process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "search_knowledge_base",
                    arguments: '{"query":"title"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { message: { role: "assistant", content: "A title is required." } },
        ],
      });
    const runTool = jest.fn().mockReturnValue([{ text: "missing-title rule" }]);

    const result = await realAsk({
      question: "Why did it fail?",
      systemPrompt: "test",
      runTool,
      client: { chat: { completions: { create } } },
    });

    expect(runTool).toHaveBeenCalledWith("search_knowledge_base", {
      query: "title",
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      answer: "A title is required.",
      mode: "llm",
      provider: "azure-openai",
    });
    expect(result.toolCalls).toHaveLength(1);
  });
});

describe("agent.ask provider switch", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.LLM_PROVIDER = "azure-openai";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
    mockedAsk.mockReset();
    process.env = { ...saved };
  });

  test("uses Azure OpenAI when LLM_PROVIDER=azure-openai", async () => {
    mockedAsk.mockResolvedValue({
      answer: "ok",
      toolCalls: [],
      mode: "llm",
      provider: "azure-openai",
    });
    const result = await ask("what is rule invalid-price?");
    expect(mockedAsk).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("azure-openai");
  });

  test("falls back to offline mode when Azure OpenAI fails", async () => {
    mockedAsk.mockRejectedValue(new Error("boom"));
    const result = await ask("what is rule invalid-price?");
    expect(result.mode).toBe("offline");
  });
});
