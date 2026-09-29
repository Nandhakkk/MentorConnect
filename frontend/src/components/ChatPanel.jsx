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
function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;

  messages.forEach(msg => {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'date', date: msgDate, id: `date-${msg.id}` });
    }
    groups.push({ type: 'message', message: msg, id: msg.id });
  });
  return groups;
}

export default function ChatPanel({ mentorship, otherPartyName, otherPartyRole }) {
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
    <div className="chat-window-modern">
      {/* Chat header */}
      <div className="chat-header-modern">
        <div className="chat-header-avatar">
          {otherPartyName.charAt(0).toUpperCase()}
        </div>
        <div className="chat-header-info">
          <h3>
            {otherPartyName}
          </h3>
          <div className="chat-header-meta">
            <span className="chat-status-indicator"></span>
            <span>{otherPartyRole}</span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="chat-messages-modern">
        {error && <div style={{ color: 'var(--error)', textAlign: 'center' }}>{error}</div>}

        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', color: '#a5b4fc' }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <p>Start a conversation</p>
            <span>Send a message to begin chatting with your {user?.role === 'STUDENT' ? 'mentor' : 'student'}.</span>
          </div>
        ) : (
          groupMessagesByDate(messages).map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="chat-date-separator">
                  <span>{formatDate(item.date)}</span>
                </div>
              );
            }
            
            const msg = item.message;
            const isMine = msg.sender?.id === user?.id || msg.senderId === user?.id;
            
            return (
              <div key={msg.id} className={`chat-message-modern ${isMine ? 'self' : 'other'}`}>
                {!isMine && (
                  <div className="chat-message-avatar">
                    {(msg.sender?.name || otherPartyName).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="chat-message-content">
                  <div className="message-bubble-modern">
                    {msg.content}
                  </div>
                  <div className="message-time-modern">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form className="chat-input-area-modern" onSubmit={handleSend}>
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
          className="chat-send-btn-modern"
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
