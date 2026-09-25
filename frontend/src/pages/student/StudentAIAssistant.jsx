import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { fetchGoals } from '../../services/goalService';
import { askAI } from '../../services/aiService';

const QUICK_ACTIONS = [
  ['Explain My Goal', 'Explain my current goal and what skills I should focus on.'],
  ['What Should I Focus On?', 'Based on my current goal and incomplete milestones, what should I focus on next?'],
  ['Help Me With My Milestones', 'Review my incomplete milestones and suggest what I should work on next.'],
  ['Prepare Me For My Next Session', 'Based on my current goal and progress, what should I discuss with my mentor in my next session?']
];
const SUGGESTIONS = ['What should I focus on next?', 'Why am I falling behind on my goal?', 'Explain my current milestones.', 'How can I prepare for my next mentor session?', 'What skills should I improve for this goal?'];

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

  useEffect(() => {
    fetchGoals().then((data) => {
      setGoals(data);
      const activeGoal = data.find((goal) => goal.status === 'ACTIVE');
      if (activeGoal) setSelectedGoalId(activeGoal.id);
    }).catch(() => setLoadError('Your goals could not be loaded. You can still ask a general question.'));
  }, []);

  const selectedGoal = useMemo(() => goals.find((goal) => goal.id === selectedGoalId), [goals, selectedGoalId]);
  const completed = selectedGoal?.milestones?.filter((milestone) => milestone.status === 'COMPLETED').length || 0;
  const total = selectedGoal?.milestones?.length || 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;

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

  return <div className="page-content ai-workspace">
    <PageHeader title="MentorConnect AI" subtitle="Your personal AI learning and mentoring assistant" />
    <p className="ai-intro">Ask for focused, practical guidance grounded in your goals and milestones. Your conversation stays in this browser session.</p>
    <div className="ai-layout">
      <aside className="ai-sidebar">
        <section className="glass-card ai-goal-card">
          <div className="ai-card-kicker">Current goal</div>
          <label htmlFor="ai-goal-select" className="sr-only">AI goal context</label>
          <select id="ai-goal-select" value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)}>
            <option value="">All active goals</option>
            {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
          {selectedGoal ? <div className="ai-goal-summary"><h3>{selectedGoal.title}</h3>{selectedGoal.description && <p>{selectedGoal.description}</p>}<span className="badge badge-success">{selectedGoal.status}</span><div className="progress-label"><span>Milestone progress</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><p className="progress-copy">{completed} of {total} milestones completed</p></div> : <div className="ai-empty-goal"><h3>No active goal yet</h3><p>Create a goal to unlock personalized AI guidance.</p><Link className="btn btn-primary" to="/student/goals">Create a goal</Link></div>}
          {loadError && <p className="ai-inline-error">{loadError}</p>}
        </section>
        <section className="glass-card ai-context-card"><h3>AI Context</h3><ul><li>Current goal{selectedGoal ? '' : 's'}</li><li>Goal milestones</li><li>Milestone completion status</li></ul><p>Context is sent only from your MentorConnect goals and milestones.</p></section>
        <section className="glass-card"><h3 className="ai-section-title">Quick AI actions</h3><div className="ai-actions">{QUICK_ACTIONS.map(([label, prompt]) => <button key={label} type="button" onClick={() => setQuestion(prompt)}>{label}</button>)}</div></section>
      </aside>
      <section className="glass-card ai-chat-card">
        <div className="ai-chat-heading"><div><h3>Learning conversation</h3><p>Review and refine each question before you send it.</p></div><span className="badge badge-purple">Goal-aware</span></div>
        <div className="ai-chat-history" aria-live="polite">
          {messages.length === 0 && !loading && <div className="ai-chat-empty"><span>✦</span><h3>Start a focused learning conversation</h3><p>Choose an action or write a question about your goals, milestones, and next steps.</p></div>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`ai-message ${message.role}`}><div className="ai-message-label">{message.role === 'user' ? 'You' : 'MentorConnect AI'}</div><div className="ai-message-body">{message.role === 'user' ? message.content : <MarkdownResponse text={message.content} />}</div></div>)}
          {loading && <div className="ai-thinking"><span className="ai-spinner" />MentorConnect AI is thinking...</div>}
        </div>
        {error && <div className="ai-error" role="alert">{error}</div>}
        <form onSubmit={submit} className="ai-composer"><label htmlFor="ai-question">Ask MentorConnect AI</label><textarea id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask MentorConnect AI about your goal..." rows="4" maxLength="2000" disabled={loading} /><div className="ai-composer-footer"><span>{question.length}/2000 · Ctrl+Enter to send</span><button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>{loading ? 'Thinking...' : 'Send to AI'}</button></div></form>
        <div className="ai-suggestions"><span>Try asking MentorConnect AI</span><div>{SUGGESTIONS.map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div></div>
      </section>
    </div>
  </div>;
}
