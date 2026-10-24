import { useEffect, useState, useRef } from 'react';
import { askMentorAI } from '../../services/aiService';
import '../student/ai-workspace.css';

const SUGGESTIONS = [
  'When is my next session?',
  'What do I have today?',
  'What is my availability tomorrow?',
  'How many students am I mentoring?',
  'Do I have assignments to review?'
];

function InlineMarkdown({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
}

function MarkdownResponse({ text }) {
  const lines = text.split('\n');
  const content = [];
  let bullets = [];
  const flushBullets = () => { if (bullets.length) { content.push(<ul key={`list-${content.length}`}>{bullets.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}</ul>); bullets = []; } };
  lines.forEach((line, index) => {
    const bullet = line.match(/^[-*•]\s+(.+)/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);
    if (bullet || numbered) { bullets.push((bullet || numbered)[1]); return; }
    flushBullets();
    if (!line.trim()) return;
    const heading = line.match(/^#{1,3}\s+(.+)/) || line.match(/^(Summary|Recommended Actions|Why|Next Step):?$/i);
    content.push(heading ? <h4 key={index}>{heading[1] || line}</h4> : <p key={index}><InlineMarkdown text={line} /></p>);
  });
  flushBullets();
  return <div className="ai-markdown">{content}</div>;
}

function friendlyError(error) {
  if (!error?.status) return 'Unable to reach MentorConnect AI. Check your connection and try again.';
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status === 403) return 'MentorConnect AI is available to approved mentors only.';
  if (error.status === 503) return 'AI service is currently unavailable. Please try again later.';
  if (error.status === 400) return error.message || 'Please enter a valid question.';
  return 'MentorConnect AI could not complete that request. Please try again.';
}

export default function MentorAIAssistant() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const submit = async (event) => {
    event?.preventDefault();
    const prompt = question.trim();
    if (!prompt || loading) return;
    setError(''); setLoading(true);
    const userMessage = { role: 'user', content: prompt, time: new Date() };
    setMessages((current) => [...current, userMessage]); setQuestion('');
    try {
      const answer = await askMentorAI(prompt);
      setMessages((current) => [...current, { role: 'assistant', content: answer, time: new Date() }]);
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally { setLoading(false); }
  };

  const handleKeyDown = (event) => { if (event.key === 'Enter' && event.ctrlKey) submit(event); };

  const handleSuggestionClick = (prompt) => {
    setQuestion(prompt);
  };

  const handleNewChat = () => {
    setMessages([]);
    setQuestion('');
    setError('');
  };

  return (
    <div className="ai-workspace-container mentor-ai-workspace">

      {/* Main Content Area */}
      <main className="ai-main-wrapper mentor-ai-main">
        <div className="ai-chat-scroll-area" ref={chatScrollRef} style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>

          <div className="mentor-ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className={`ai-orb ${loading ? 'thinking' : ''}`} style={{ fontSize: '1.5rem' }}>🤖</div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Mentor AI Assistant</h1>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Quick info about your schedule and students</p>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleNewChat}>
              + New Chat
            </button>
          </div>

          {messages.length === 0 && !loading && (
            <div className="ai-welcome-state">
              <h2>Welcome to your Mentor Assistant</h2>
              <p>I can help you quickly check your schedule, find out who your next student is, or see your pending assignments.</p>

              <div className="ai-suggestions-grid">
                {SUGGESTIONS.map((prompt, idx) => (
                  <button key={idx} className="ai-suggestion-chip" onClick={() => handleSuggestionClick(prompt)}>
                    <span>{idx === 0 ? '📅' : idx === 1 ? '📝' : idx === 2 ? '⏳' : idx === 3 ? '🎓' : '📚'}</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ai-chat-content">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`ai-msg-row ${message.role}`}>
                <div className="ai-msg-identity">
                  {message.role === 'assistant' ? (
                    <><div className="ai-mini-orb" style={{ background: 'var(--primary)' }}></div> Mentor AI</>
                  ) : 'You'}
                </div>
                <div className="ai-msg-bubble" style={message.role === 'assistant' ? { border: '1px solid var(--border-subtle)' } : {}}>
                  {message.role === 'user' ? message.content : <MarkdownResponse text={message.content} />}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-loading-indicator">
                <div className="ai-mini-orb" style={{ background: 'var(--primary)' }}></div>
                <span>AI is checking your schedule</span>
                <div className="ai-dots">
                  <span className="ai-dot"></span>
                  <span className="ai-dot"></span>
                  <span className="ai-dot"></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="ai-error-banner" style={{ maxWidth: '900px', margin: '0 auto 1rem auto' }}>{error}</div>}

        {/* Message Composer */}
        <div className="ai-composer-container" style={{ maxWidth: '900px', margin: '0 auto', background: 'transparent' }}>
          <form className="ai-composer-box" onSubmit={submit} style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <textarea
              className="ai-composer-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your sessions, availability, or students..."
              rows={Math.min(5, question.split('\n').length || 1)}
              disabled={loading}
              aria-label="Ask Mentor AI"
            />
            <div className="ai-composer-actions">
              <span className="ai-composer-hint">Ctrl+Enter to send</span>
              <button
                type="submit"
                className="ai-composer-send"
                disabled={loading || !question.trim()}
                aria-label="Send message"
              >
                ➤
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
