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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Chat header */}
      <div className="chat-header">
        <h3>
          <span className="chat-status-indicator"></span>
          {otherPartyName}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active mentorship</span>
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {error && <div style={{ color: 'var(--error)', textAlign: 'center' }}>{error}</div>}

        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Start the conversation with your {user?.role === 'STUDENT' ? 'mentor' : 'student'}.
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender?.id === user?.id || msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`chat-message ${isMine ? 'self' : 'other'}`}>
                {!isMine && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', marginLeft: '0.25rem' }}>
                    {msg.sender?.name}
                  </span>
                )}
                <div className="message-bubble">
                  {msg.content}
                </div>
                <div className="message-meta">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form className="chat-input-area" onSubmit={handleSend}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="form-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="btn btn-primary chat-send-btn"
          disabled={!input.trim()}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
}
