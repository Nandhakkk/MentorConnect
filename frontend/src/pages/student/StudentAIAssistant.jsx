import { useState, useEffect } from 'react';
import { fetchGoals } from '../../services/goalService';
import { askAI } from '../../services/aiService';

const EXAMPLE_QUESTIONS = [
  'What should I focus on this week?',
  'How can I complete my current milestones?',
  'Create a learning plan for my goal.',
  'Which milestone should I prioritize?',
];

// Simple markdown-to-HTML: bold, bullets, newlines
function formatResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/((<li>.*<\/li>\n?)+)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export default function StudentAIAssistant() {
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]); // [{ question, answer }]

  // Load student's goals on mount
  useEffect(() => {
    fetchGoals()
      .then(data => setGoals(data.filter(g => g.status === 'ACTIVE')))
      .catch(err => console.error('Failed to load goals:', err));
  }, []);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const result = await askAI(question.trim(), selectedGoalId || null);
      setAnswer(result);
      setHistory(prev => [{ question: question.trim(), answer: result }, ...prev.slice(0, 4)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (q) => {
    setQuestion(q);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">✨ AI Learning Assistant</h2>
          <p className="page-subtitle">Get personalized learning guidance based on your goals and milestones.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* Left: Input form */}
        <div>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <form onSubmit={handleAsk}>
              {/* Goal selector */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Focus on a specific goal (optional)
                </label>
                <select
                  value={selectedGoalId}
                  onChange={e => setSelectedGoalId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.95rem' }}
                >
                  <option value="">All active goals</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>

              {/* Question input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Ask your question *
                </label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="e.g. What should I focus on this week?"
                  rows="4"
                  maxLength={2000}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.95rem', resize: 'vertical' }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {question.length}/2000
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !question.trim()}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: loading || !question.trim() ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  border: 'none', borderRadius: '8px', color: 'white',
                  fontSize: '1rem', fontWeight: 600, cursor: loading || !question.trim() ? 'default' : 'pointer',
                  transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {loading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                    Thinking...
                  </>
                ) : '✨ Ask AI'}
              </button>
            </form>

            {/* Example questions */}
            <div style={{ marginTop: '1.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Try an example:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {EXAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleExampleClick(q)}
                    style={{
                      background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                      color: 'var(--accent-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px',
                      cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', transition: 'background 0.15s'
                    }}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI response */}
        <div>
          {error && (
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444', marginBottom: '1.5rem' }}>
              <p style={{ color: '#ef4444', margin: 0, fontSize: '0.95rem' }}>{error}</p>
            </div>
          )}

          {answer && (
            <div className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid #6366f1', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>✨</span>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-primary)' }}>AI Response</h3>
              </div>
              <div
                style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}
                dangerouslySetInnerHTML={{ __html: `<p>${formatResponse(answer)}</p>` }}
              />
            </div>
          )}

          {!answer && !error && !loading && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Ask a question to get personalized AI guidance based on your goals.
              </p>
            </div>
          )}

          {loading && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🤔</div>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Generating personalized advice...</p>
            </div>
          )}

          {/* Session history */}
          {history.length > 1 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Earlier in this session</h4>
              {history.slice(1).map((h, i) => (
                <div key={i} className="glass-card" style={{ padding: '1rem', marginBottom: '0.75rem', opacity: 0.75 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                    Q: {h.question}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {h.answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
