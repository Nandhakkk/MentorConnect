import { useAuth } from '../../context/AuthContext';

export default function AccountPrivacy() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Account & Privacy</h2>
          <p className="page-subtitle">Manage your account information and privacy settings.</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', maxWidth: '800px' }}>
        <h3 className="card-section-title">Account Information</h3>
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div>
            {user.profileImage ? (
              <img src={user.profileImage} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-subtle)' }} />
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#FFFFFF', fontWeight: 700 }}>
                {user.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
            <div style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
            <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {user.role} {user.mentorProfile?.mentorType === 'PEER' ? '(Peer Mentor)' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', maxWidth: '800px' }}>
        <h3 className="card-section-title">Privacy Information</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
          MentorConnect prioritizes your data privacy and security. Below is a breakdown of what information is visible to other users on the platform.
        </p>

        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Visible to All Registered Users</h4>
          <ul style={{ color: 'var(--text-secondary)', marginLeft: '1.5rem', lineHeight: 1.6 }}>
            <li>Your public Name and Profile Picture.</li>
            <li>For Mentors: Your public professional portfolio (Headline, Bio, Teaching Topics, Hourly Rate, Average Rating).</li>
            <li>For Mentors: Public reviews left by past students.</li>
          </ul>
        </div>

        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Strictly Private (Visible Only to Admins)</h4>
          <ul style={{ color: 'var(--text-secondary)', marginLeft: '1.5rem', lineHeight: 1.6 }}>
            <li>Your uploaded verification credentials (Certificates, IDs, Documents).</li>
            <li>Internal AI screening reasoning and evaluation data.</li>
            <li>Your exact Date of Birth and personal contact numbers.</li>
            <li>Financial payout/payment records.</li>
          </ul>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          Note: Verified claims (e.g. "5 Years Experience") will appear on your public profile, but the underlying uploaded evidence remains strictly confidential and is only accessible by platform administrators.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '2rem', maxWidth: '800px' }}>
        <h3 className="card-section-title">Security</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          To protect your account, ensure you log out when using shared devices.
        </p>
        <button className="btn btn-primary" onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span aria-hidden="true">🚪</span> Secure Logout
        </button>
      </div>
    </div>
  );
}
