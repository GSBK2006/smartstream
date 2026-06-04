import React, { useState } from 'react';
import { LockKeyhole, User, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage({ onLoginSuccess, backendUrl }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const endpoint = isRegister ? '/api/register' : '/api/login';
    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (isRegister) {
          setSuccess("Account created! You can now log in.");
          setIsRegister(false);
          setPassword('');
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setError(data.error || "Authentication failed.");
      }
    } catch (err) {
      setError("Unable to connect to authorization server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '65vh',
      animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      <div className="glass-panel" style={{
        width: '360px',
        padding: '2.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        boxShadow: 'var(--shadow-main), 0 0 40px 0 hsl(var(--primary-glow))',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(var(--accent-purple-glow)) 0%, transparent 70%)',
          filter: 'blur(20px)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Header Visual */}
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.8rem',
            borderRadius: '50%',
            backgroundColor: 'hsl(var(--primary-glow))',
            color: 'hsl(var(--primary))',
            marginBottom: '0.75rem',
            border: '1px solid hsl(var(--primary) / 0.15)',
            boxShadow: '0 0 15px hsl(var(--primary-glow))'
          }}>
            <LockKeyhole size={24} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
            {isRegister ? 'Register' : 'Login'}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginTop: '0.2rem' }}>
            {isRegister ? 'Create credentials to access the data pipeline' : 'Sign in to access your data pipeline'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 1 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Username"
                style={{ width: '100%', paddingLeft: '2.2rem' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <LockKeyhole size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password"
                style={{ width: '100%', paddingLeft: '2.2rem' }}
                required
              />
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'hsl(var(--danger) / 0.08)',
              border: '1px solid hsl(var(--danger) / 0.2)',
              color: 'hsl(var(--danger))',
              fontSize: '0.75rem'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'hsl(var(--success) / 0.08)',
              border: '1px solid hsl(var(--success) / 0.2)',
              color: 'hsl(var(--success))',
              fontSize: '0.75rem'
            }}>
              <ShieldCheck size={14} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary btn-gradient" 
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.4rem', height: '36px' }}
          >
            {loading ? 'Validating...' : (isRegister ? 'Register' : 'Log In')}
          </button>
        </form>

        {/* Toggle Footer */}
        <div style={{ textAlign: 'center', fontSize: '0.75rem', borderTop: '1px solid hsl(var(--border-light))', paddingTop: '1rem', marginTop: '0.2rem', zIndex: 1 }}>
          <span style={{ color: 'hsl(var(--text-secondary))' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
          </span>{' '}
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(null); setSuccess(null); }}
            style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', fontWeight: 600, padding: 0, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

      </div>
    </div>
  );
}
