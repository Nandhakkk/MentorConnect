import { useState, useEffect } from 'react';
import { fetchMentorMentorships } from '../../services/mentorService';
import { disconnectSocket } from '../../services/socketService';
import ChatPanel from '../../components/ChatPanel';

export default function MentorMessages() {
  const [mentorships, setMentorships] = useState([]);
  const [selectedMentorship, setSelectedMentorship] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMentorMentorships();
        const active = data.filter(m => m.status === 'ACTIVE');
        setMentorships(active);
        if (active.length > 0) setSelectedMentorship(active[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();

    return () => disconnectSocket();
  }, []);

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="chat-workspace-page">

      {/* Left: Student list */}
      <div className="chat-sidebar-modern">
        <div className="chat-sidebar-header">
          <h3>My Students</h3>
        </div>

        {mentorships.length === 0 ? (
          <div style={{ padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
            No active mentorships yet.
          </div>
        ) : (
          mentorships.map((m) => {
            const name = m.student?.user?.name || 'Student';
            const isSelected = selectedMentorship?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMentorship(m)}
                className={`chat-sidebar-item ${isSelected ? 'active' : ''}`}
              >
                <div className="chat-sidebar-item-avatar">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="chat-sidebar-item-info">
                  <div className="chat-sidebar-item-name">{name}</div>
                  <div className="chat-sidebar-item-role">{m.student?.careerGoal || 'Student'}</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Right: Chat panel */}
      {selectedMentorship ? (
        <ChatPanel
          key={selectedMentorship.id}
          mentorship={selectedMentorship}
          otherPartyName={selectedMentorship.student?.user?.name || 'Student'}
          otherPartyRole="Student"
        />
      ) : (
        <div className="chat-empty-state" style={{ flex: 1 }}>
          <p>No student selected</p>
          <span>Select a student to start chatting.</span>
        </div>
      )}
    </div>
  );
}
