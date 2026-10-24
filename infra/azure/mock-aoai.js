const http = require('http');

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      console.log(req.method, req.url);
      const messages = JSON.parse(body || '{}').messages || [];
      const hasToolResult = messages.some((m) => m.role === 'tool');
      const message = hasToolResult
        ? { role: 'assistant', content: 'Mock answer: a product needs a title.' }
        : {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'search_knowledge_base', arguments: '{"query":"missing title"}' },
            }],
          };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: 'mock-1',
        object: 'chat.completion',
        created: 0,
        model: 'mock',
        choices: [{ index: 0, finish_reason: 'stop', message }],
      }));
    });
  })
  .listen(9999, () => console.log('Mock Azure OpenAI on :9999'));