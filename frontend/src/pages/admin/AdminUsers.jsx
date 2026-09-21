import { useState, useEffect } from 'react';
import { fetchAdminUsers } from '../../services/adminService';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    loadUsers();
  }, [roleFilter]); // Reload when role filter changes

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminUsers(roleFilter, search);
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers();
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Users 👥</h2>
          <p className="page-subtitle">View and filter all registered platform users.</p>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Search</label>
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
          <div style={{ flex: '0 0 150px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Filter by Role</label>
            <select 
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            >
              <option value="ALL">All Roles</option>
              <option value="STUDENT">Students</option>
              <option value="MENTOR">Mentors</option>
              <option value="ADMIN">Admins</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Search</button>
          </div>
        </form>
      </div>

      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {error && <div style={{ color: '#ef4444', padding: '1rem' }}>{error}</div>}
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Role</th>
              <th style={{ padding: '1rem' }}>Registered</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: 'white' }}>{user.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : user.role === 'MENTOR' ? 'badge-purple' : 'badge-success'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
