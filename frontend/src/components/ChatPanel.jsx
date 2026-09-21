import { useState, useEffect, useRef } from 'react';
import { getMessages } from '../services/messageService';
import {
  connectSocket,
  joinMentorshipRoom,
  emitMessage,
  onNewMessage,
  offNewMessage
} from '../services/socketService';
import { useAuth } from '../context/AuthContext';

/**
 * Chat panel for a single mentorship.
 * Used by both StudentMessages and MentorMessages.
 */
export default function ChatPanel({ mentorship, otherPartyName }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // Load history and join Socket.IO room when mentorship changes
  useEffect(() => {
    if (!mentorship?.id) return;
    let cancelled = false;

    const loadAndJoin = async () => {
      try {
        setLoading(true);
        setError('');
        const history = await getMessages(mentorship.id);
        if (!cancelled) setMessages(history);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Connect socket and join room
      connectSocket();
      joinMentorshipRoom(mentorship.id);
    };

    loadAndJoin();
    return () => { cancelled = true; };
  }, [mentorship?.id]);

  // Subscribe to real-time messages
  useEffect(() => {
    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        // Avoid duplicate if the message was already added optimistically
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    onNewMessage(handleNewMessage);
    return () => offNewMessage(handleNewMessage);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    emitMessage(mentorship.id, input.trim());
    setInput('');
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading messages...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Chat header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>{otherPartyName}</h3>
        <span style={{ fontSize: '0.75rem', color: '#10b981' }}>● Active mentorship</span>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {error && <div style={{ color: '#ef4444', textAlign: 'center' }}>{error}</div>}

        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Start the conversation with your {user?.role === 'STUDENT' ? 'mentor' : 'student'}.
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender?.id === user?.id || msg.senderId === user?.id;
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                {!isMine && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', marginLeft: '0.25rem' }}>
                    {msg.sender?.name}
                  </span>
                )}
                <div style={{
                  maxWidth: '65%',
                  padding: '0.6rem 1rem',
                  borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMine
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                    : 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word'
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', marginLeft: isMine ? 0 : '0.25rem', marginRight: isMine ? '0.25rem' : 0 }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '24px',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(255,255,255,0.06)',
            color: 'white',
            outline: 'none',
            fontSize: '0.95rem'
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '24px',
            background: input.trim() ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'white',
            cursor: input.trim() ? 'pointer' : 'default',
            fontWeight: 600,
            fontSize: '0.9rem',
            transition: 'background 0.2s'
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
