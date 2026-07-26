import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import RulesView from './components/RulesView.jsx';
import AgentChat from './components/AgentChat.jsx';

export default function App() {
  const [view, setView] = useState('feed');
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Sections">
        <div className="nav-mark" aria-hidden="true">FDS</div>
        <button aria-current={view === 'feed'} onClick={() => setView('feed')}>
          Feed
        </button>
        <button aria-current={view === 'rules'} onClick={() => setView('rules')}>
          Rules
        </button>
      </nav>

      <main className="main">
        {view === 'feed' ? <Dashboard /> : <RulesView />}
      </main>

      {!chatOpen && (
        <button className="chat-toggle" onClick={() => setChatOpen(true)}>
          Ask the agent
        </button>
      )}
      <AgentChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
