import { useState } from 'react';
import { askAgent } from '../api.js';

export default function AgentChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const { answer } = await askAgent(question);
      setMessages((m) => [...m, { role: 'agent', text: answer }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className={`chat-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="chat-header">
        <h2>Ask the agent</h2>
        <button onClick={onClose} aria-label="Close chat">×</button>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">
            Try: "why did today&rsquo;s import reject records?" or "why does invalid currency get
            rejected?" — answers are grounded in the validation rules and the last run you
            uploaded.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role === 'error' ? 'error-msg' : m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && <div className="chat-bubble agent">Thinking…</div>}
      </div>
      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about a rejection or rule…"
          aria-label="Question for the agent"
        />
        <button onClick={send} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </aside>
  );
}
