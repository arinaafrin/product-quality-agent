import { useState } from 'react';
import { login } from '../api.js';

export default function LoginGate({ onAuthenticated }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(apiKey.trim());
      onAuthenticated();
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-gate">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Product Quality Agent</h1>
        <p>Enter your API key to continue.</p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API key"
          autoFocus
          required
        />
        <button type="submit" disabled={loading || !apiKey.trim()}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p role="alert" className="login-error">{error}</p>}
      </form>
    </div>
  );
}
