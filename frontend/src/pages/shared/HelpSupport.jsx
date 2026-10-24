import { useState } from 'react';

export default function HelpSupport() {
  const [activeTab, setActiveTab] = useState('GETTING_STARTED');

  const tabs = [
    { id: 'GETTING_STARTED', label: 'Getting Started' },
    { id: 'LEARNERS', label: 'For Learners' },
    { id: 'MENTORS', label: 'For Professional Mentors' },
    { id: 'PEER_MENTORS', label: 'For Peer Mentors' },
    { id: 'GUARDIANS', label: 'For Guardians' },
    { id: 'PAYMENTS', label: 'Payments' },
    { id: 'SESSIONS', label: 'Online Sessions' },
    { id: 'RULES', label: 'Important Rules' },
    { id: 'AI_ASSISTANTS', label: 'AI Assistant Information' }
  ];

  const content = {
    GETTING_STARTED: (
      <>
        <h3>Getting Started</h3>
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How to complete your profile</h4>
          <p>Navigate to the Profile page from the top-right menu. Fill in your details, ensure they are accurate, and save your changes.</p>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How to navigate the dashboard</h4>
          <p>Your dashboard is your home base. It gives you a quick overview of your activities, upcoming sessions, pending tasks, and goals.</p>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How to use notifications</h4>
          <p>The bell icon shows real-time alerts. Check it regularly for session updates, new messages, or assignment feedback.</p>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How to find features available to you</h4>
          <p>Use the side navigation menu to access all available tools such as Mentors, Sessions, Assignments, Complaints, and your AI Assistant.</p>
        </div>
      </>
    ),
    LEARNERS: (
      <>
        <h3>For Learners</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Finding a Mentor</h4>
          <ul>
            <li>Browse available mentors.</li>
            <li>View their expertise, topics, fee, availability, ratings and profile information.</li>
            <li>AI recommendations can help suggest suitable mentors.</li>
            <li>The learner makes the final choice.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Booking a Session</h4>
          <ul>
            <li>Select a mentor.</li>
            <li>Select an available date and time.</li>
            <li>Enter the session topic.</li>
            <li>Complete payment.</li>
            <li>The booking is confirmed after successful payment.</li>
            <li>Sessions must be booked at least 6 hours in advance.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Sessions</h4>
          <ul>
            <li>Join the online session from the session page.</li>
            <li>The session link becomes available around the session time.</li>
            <li>A reminder is provided before the session.</li>
            <li>Sessions can be completed, cancelled or marked as missed depending on what happens.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Assignments</h4>
          <ul>
            <li>Mentors may give assignments after sessions.</li>
            <li>Learners can submit their work.</li>
            <li>Mentors can review submissions and provide instructions or feedback.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Reviews</h4>
          <ul>
            <li>After a completed session, learners can rate and review their mentor.</li>
            <li>Reviews should be honest and respectful.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Complaints</h4>
          <ul>
            <li>A learner can register a complaint when there is a genuine issue.</li>
            <li>The reported person can provide their response.</li>
            <li>The complaint can include further discussion while it is being reviewed.</li>
            <li>Admin handles the final resolution.</li>
          </ul>
        </div>
      </>
    ),
    MENTORS: (
      <>
        <h3>For Professional Mentors</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Becoming a Mentor</h4>
          <ul>
            <li>Submit the Professional Mentor Application.</li>
            <li>Provide your professional information and supporting evidence.</li>
            <li>Your application is reviewed before you become an active mentor.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Profile</h4>
          <ul>
            <li>Keep your profile information accurate and up to date.</li>
            <li>Your approved professional information is shown to learners.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Availability</h4>
          <ul>
            <li>Set the times when learners can book sessions.</li>
            <li>Keep availability updated.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Sessions</h4>
          <ul>
            <li>View upcoming sessions.</li>
            <li>Join sessions at the scheduled time.</li>
            <li>Communicate with learners through the platform.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Assignments</h4>
          <ul>
            <li>Give assignments when appropriate.</li>
            <li>Review learner submissions.</li>
            <li>Provide useful feedback or instructions.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Verification Requests</h4>
          <ul>
            <li>After becoming an approved mentor, you do not need to submit the original application again.</li>
            <li>For a new certificate, experience, skill or teaching topic, submit a Verification Request.</li>
            <li>Provide supporting evidence such as a document/image and/or a relevant link when required.</li>
            <li>New information becomes part of your verified profile only after approval.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mentor AI Assistant</h4>
          <ul>
            <li>Ask about your upcoming sessions.</li>
            <li>Ask about your availability.</li>
            <li>Ask what you are teaching.</li>
            <li>Ask about your students and pending tasks.</li>
            <li>Use it for quick information about your current and upcoming plans.</li>
          </ul>
        </div>
      </>
    ),
    PEER_MENTORS: (
      <>
        <h3>For Peer Mentors</h3>
        <ul>
          <li>Peer mentors are learners who have also been approved to mentor others.</li>
          <li>They can continue using MentorConnect as learners.</li>
          <li>They can also provide mentoring sessions according to their approved mentoring capability.</li>
          <li>Peer mentor information and activities must remain genuine and accurate.</li>
        </ul>
      </>
    ),
    GUARDIANS: (
      <>
        <h3>For Guardians</h3>
        <ul>
          <li>Guardians can view information about learners linked to their account.</li>
          <li>Guardians can monitor relevant learning progress and sessions.</li>
          <li>Private learner conversations and private AI interactions are not available to guardians.</li>
        </ul>
      </>
    ),
    PAYMENTS: (
      <>
        <h3>Payments</h3>
        <ul>
          <li>Session fees are shown before booking.</li>
          <li>Payment is required to confirm a paid session.</li>
          <li>Always check the mentor, date, time and amount before completing payment.</li>
          <li>Keep payment-related information and receipts for your records.</li>
          <li>Mentor payouts are handled through the platform.</li>
        </ul>
      </>
    ),
    SESSIONS: (
      <>
        <h3>Online Sessions</h3>
        <ul>
          <li>Sessions are held online.</li>
          <li>Join using the session's provided meeting option.</li>
          <li>Join on time.</li>
          <li>Be respectful and professional.</li>
          <li>Do not share private session information unnecessarily.</li>
        </ul>
      </>
    ),
    RULES: (
      <>
        <h3>Important Rules</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Respect</h4>
          <ul>
            <li>Treat learners, mentors and other users respectfully.</li>
            <li>Harassment, abuse and inappropriate behaviour are not acceptable.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Honest Information</h4>
          <ul>
            <li>Users must provide truthful information.</li>
            <li>Mentors must not claim qualifications, experience or certificates they cannot support.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mentor Verification</h4>
          <ul>
            <li>Verified professional information must be genuine.</li>
            <li>New professional claims require appropriate evidence and approval.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Payments</h4>
          <ul>
            <li>Check booking details before payment.</li>
            <li>Do not attempt to bypass platform payment procedures.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Sessions</h4>
          <ul>
            <li>Attend sessions at the scheduled time.</li>
            <li>Repeated misuse or inappropriate behaviour may result in action on the account.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Complaints</h4>
          <ul>
            <li>Complaints should be genuine and submitted with accurate information.</li>
            <li>Do not use complaints to harass or falsely accuse another user.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Privacy</h4>
          <ul>
            <li>Do not share another user's private information.</li>
            <li>Private verification documents are not intended for general users.</li>
          </ul>
        </div>
      </>
    ),
    AI_ASSISTANTS: (
      <>
        <h3>AI Assistant Information</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Student AI Assistant</h4>
          <ul>
            <li>Helps learners with study and mentoring-related guidance.</li>
            <li>Can help with goals, learning plans and mentor-related questions.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mentor AI Assistant</h4>
          <ul>
            <li>Helps mentors quickly check their current and upcoming sessions, availability, students, teaching topics and pending tasks.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Important</h4>
          <ul>
            <li>AI responses are assistance and should be checked against the relevant information shown in the platform when making important decisions.</li>
          </ul>
        </div>
      </>
    )
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Help & Support</h2>
          <p className="page-subtitle">Learn how to use MentorConnect effectively.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="glass-card" style={{ width: '250px', padding: '1rem', flexShrink: 0, flexGrow: 1, minWidth: '200px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {tabs.map(tab => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    background: activeTab === tab.id ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: activeTab === tab.id ? '1px solid var(--border-subtle)' : '1px solid transparent',
                    color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === tab.id ? '600' : '400',
                    transition: 'all 0.2s',
                    marginBottom: '0.25rem'
                  }}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card" style={{ flex: 3, padding: '2rem', minWidth: '300px', minHeight: '500px' }}>
          <div className="help-content-area" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {content[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
}
