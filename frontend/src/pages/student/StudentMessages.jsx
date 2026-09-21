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
    <div className="page-content" style={{ padding: 0, height: 'calc(100vh - 60px)', display: 'flex', overflow: 'hidden' }}>

      {/* Left: Mentorship list */}
      <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>My Mentors</h3>
        </div>

        {mentorships.length === 0 ? (
          <div style={{ padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.9rem 1rem',
                  background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: 'none',
                  borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: isSelected ? 600 : 400, fontSize: '0.9rem' }}>{name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.mentor?.expertise || 'Mentor'}</div>
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
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Select a mentor to start chatting.
        </div>
      )}
    </div>
  );
}
