import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchGoals } from '../../services/goalService';
import { askAI } from '../../services/aiService';
import './ai-workspace.css';

const SUGGESTIONS = [
  'What should I study next?',
  'Help me plan my goal',
  'Create a learning roadmap',
  'Explain a difficult topic',
  'Create a study plan'
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
  if (error.status === 403) return 'MentorConnect AI is available to student accounts only.';
  if (error.status === 404) return 'The selected goal is no longer available. Choose another goal and try again.';
  if (error.status === 503) return 'AI service is currently unavailable. Please try again later.';
  if (error.status === 400) return error.message || 'Please enter a valid question.';
  return 'MentorConnect AI could not complete that request. Please try again.';
}

export default function StudentAIAssistant() {
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  
  const chatScrollRef = useRef(null);

  useEffect(() => {
    fetchGoals().then((data) => {
      setGoals(data);
      const activeGoal = data.find((goal) => goal.status === 'ACTIVE');
      if (activeGoal) setSelectedGoalId(activeGoal.id);
    }).catch(() => setLoadError('Your goals could not be loaded. You can still ask a general question.'));
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const selectedGoal = useMemo(() => goals.find((goal) => goal.id === selectedGoalId), [goals, selectedGoalId]);

  const submit = async (event) => {
    event?.preventDefault();
    const prompt = question.trim();
    if (!prompt || loading) return;
    setError(''); setLoading(true);
    const userMessage = { role: 'user', content: prompt, time: new Date() };
    setMessages((current) => [...current, userMessage]); setQuestion('');
    try {
      const answer = await askAI(prompt, selectedGoalId || null);
      setMessages((current) => [...current, { role: 'assistant', content: answer, time: new Date() }]);
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally { setLoading(false); }
  };

  const handleKeyDown = (event) => { if (event.key === 'Enter' && event.ctrlKey) submit(event); };
  const handleSuggestionClick = (prompt) => {
    setQuestion(prompt);
  };

  return (
    <div className="ai-workspace-container">
      {/* AI Header */}
      <header className="ai-dedicated-header">
        <div className="ai-header-brand">
          <div className={`ai-orb ${loading ? 'thinking' : ''}`}>✨</div>
          <div className="ai-header-text">
            <h1>AI Learning Assistant</h1>
            <p>Your personal guide for learning, goals and next steps.</p>
          </div>
        </div>
        
        <div className="ai-header-context">
          <label htmlFor="ai-context">Context</label>
          <select id="ai-context" className="ai-context-select" value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)}>
            <option value="">General Learning</option>
            {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
        </div>
      </header>

      {/* Main Conversation Area */}
      <main className="ai-main-content">
        <div className="ai-chat-scroll-area" ref={chatScrollRef}>
          {messages.length === 0 && !loading && (
            <div className="ai-welcome-state">
              <h2>How can I help you learn today?</h2>
              <p>Tell me what you're trying to achieve, and I'll help you break it into practical next steps.</p>
              
              <div className="ai-suggestions-grid">
                {SUGGESTIONS.map((prompt, idx) => (
                  <button key={idx} className="ai-suggestion-chip" onClick={() => handleSuggestionClick(prompt)}>
                    <span>{idx === 0 ? '📚' : idx === 1 ? '🎯' : idx === 2 ? '🗺️' : idx === 3 ? '💡' : '⏱️'}</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ai-msg-row ${message.role}`}>
              <div className="ai-msg-identity">
                {message.role === 'assistant' ? (
                  <><div className="ai-mini-orb"></div> MentorConnect AI</>
                ) : 'You'}
              </div>
              <div className="ai-msg-bubble">
                {message.role === 'user' ? message.content : <MarkdownResponse text={message.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-loading-indicator">
              <div className="ai-mini-orb"></div>
              <span>AI is thinking</span>
              <div className="ai-dots">
                <span className="ai-dot"></span>
                <span className="ai-dot"></span>
                <span className="ai-dot"></span>
              </div>
            </div>
          )}
        </div>

        {error && <div className="ai-error-banner">{error}</div>}

        {/* Message Composer */}
        <div className="ai-composer-container">
          <form className="ai-composer-box" onSubmit={submit}>
            <textarea
              className="ai-composer-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI learning assistant..."
              rows={Math.min(5, question.split('\n').length || 1)}
              disabled={loading}
              aria-label="Ask MentorConnect AI"
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
