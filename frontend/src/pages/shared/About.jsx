export default function About() {
  return (
    <div className="page-content">
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{ background: 'var(--accent-primary)', color: 'white', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold' }}>
            M
          </div>
        </div>
        <h2 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>MentorConnect</h2>
        <p className="page-subtitle" style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', fontWeight: '500' }}>
          AI-Powered Goal-Based Mentoring Platform
        </p>
      </div>

      <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '2rem', maxWidth: '900px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.1rem', textAlign: 'center' }}>
          MentorConnect helps learners connect with suitable mentors, plan their learning goals, attend mentoring sessions, communicate with mentors and track their learning activities in one place.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto 2rem' }}>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>Learners</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Find mentors, set goals, book sessions, attend sessions, complete assignments and provide reviews.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>Professional Mentors</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Share verified expertise, mentor learners, manage availability, conduct sessions and support learners through assignments and guidance.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>Peer Mentors</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Experienced learners can become approved peer mentors and support other learners while continuing their own learning journey.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>Guardians</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Guardians can monitor relevant information for linked learners.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>Admin</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Admin manages mentor verification, users, complaints, payments and overall platform operations.
          </p>
        </div>

      </div>

      <div className="glass-card" style={{ padding: '2.5rem', maxWidth: '900px', margin: '0 auto' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.3rem', textAlign: 'center' }}>
          Main Features
        </h3>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.5rem', columns: 'auto 2', gap: '2rem' }}>
          <li>Goal-based mentoring</li>
          <li>Mentor discovery</li>
          <li>AI mentor recommendations</li>
          <li>Session booking</li>
          <li>Online mentoring sessions</li>
          <li>Messaging</li>
          <li>Assignments</li>
          <li>Reviews</li>
          <li>Complaints</li>
          <li>Mentor verification</li>
          <li>AI assistance</li>
          <li>Payments and payouts</li>
        </ul>
      </div>

    </div>
  );
}
