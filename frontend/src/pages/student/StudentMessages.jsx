import { useState, useEffect } from 'react';
import { fetchStudentMentorships } from '../../services/mentorService';
import { disconnectSocket } from '../../services/socketService';
import ChatPanel from '../../components/ChatPanel';

export default function StudentMessages() {
  const [mentorships, setMentorships] = useState([]);
  const [selectedMentorship, setSelectedMentorship] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchStudentMentorships();
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

    // Disconnect socket when leaving the page
    return () => disconnectSocket();
  }, []);

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="chat-workspace-page">

      {/* Left: Mentorship list */}
      <div className="chat-sidebar-modern">
        <div className="chat-sidebar-header">
          <h3>My Mentors</h3>
        </div>

        {mentorships.length === 0 ? (
          <div style={{ padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
            No active mentorships yet.
          </div>
        ) : (
          mentorships.map((m) => {
            const name = m.mentor?.user?.name || 'Mentor';
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
                  <div className="chat-sidebar-item-role">{m.mentor?.expertise || 'Mentor'}</div>
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
          otherPartyName={selectedMentorship.mentor?.user?.name || 'Mentor'}
          otherPartyRole="Mentor"
        />
      ) : (
        <div className="chat-empty-state" style={{ flex: 1 }}>
          <p>No mentor selected</p>
          <span>Select a mentor to start chatting.</span>
        </div>
      )}
    </div>
  );
}
