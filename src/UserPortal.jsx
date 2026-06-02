import React, { useState } from 'react';

const UserPortal = ({ onLoginSuccess, onRegisterClick, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Passenger');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('login'); // 'login', 'forgot', 'reset'
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast('Please enter your email.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, role })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.user.status === 'Suspended') {
          showToast('Access denied: Your account has been suspended by an administrator.', 'danger');
          return;
        }
        localStorage.setItem('token', data.token); // Store JWT
        onLoginSuccess(data.user);
        showToast(`Welcome back, ${data.user.name}!`, 'success');
      } else {
        showToast(data.error || 'Login failed. Check credentials.', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error connecting to backend.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast('Please enter your corporate email.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setViewMode('reset');
      } else {
        showToast(data.error || 'Request failed.', 'danger');
      }
    } catch (err) {
      showToast('Network error.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      showToast('Token and new password are required.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: resetToken.trim(), newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setViewMode('login');
        setPassword('');
      } else {
        showToast(data.error || 'Reset failed.', 'danger');
      }
    } catch (err) {
      showToast('Network error.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === 'forgot') {
    return (
      <div className="flex justify-center items-center min-h-[85vh] bg-transparent p-4">
        <div className="glass-panel animate-slide-in w-full max-w-[440px] p-8 rounded-2xl flex flex-col gap-6">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">Reset Password</h2>
            <p className="text-on-surface-variant text-sm mt-1">Enter your email to receive a reset token</p>
          </div>
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-on-surface-variant font-medium">Corporate Email</label>
              <input 
                type="email" 
                placeholder="e.g. rohan.s@ril.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full glass-input rounded-lg px-4 py-3 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-bold bg-gradient-to-r from-primary to-accent-teal transition-all hover:shadow-[0_0_15px_rgba(103,218,182,0.4)]"
            >
              {loading ? 'Sending...' : 'Request Token'}
            </button>
          </form>
          <div className="text-center text-sm text-on-surface-variant mt-2">
            Remembered your password?{' '}
            <span onClick={() => setViewMode('login')} className="text-primary font-bold hover:underline cursor-pointer">
              Sign In
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'reset') {
    return (
      <div className="flex justify-center items-center min-h-[85vh] bg-transparent p-4">
        <div className="glass-panel animate-slide-in w-full max-w-[440px] p-8 rounded-2xl flex flex-col gap-6">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">Set New Password</h2>
            <p className="text-on-surface-variant text-sm mt-1">Check your email for the token</p>
          </div>
          <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-on-surface-variant font-medium">Reset Token</label>
              <input 
                type="text" 
                placeholder="Enter 6-character token" 
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value.toUpperCase())}
                required
                className="w-full glass-input rounded-lg px-4 py-3 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-on-surface-variant font-medium">New Password</label>
              <input 
                type="password" 
                placeholder="At least 8 characters" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full glass-input rounded-lg px-4 py-3 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-bold bg-gradient-to-r from-primary to-accent-teal transition-all hover:shadow-[0_0_15px_rgba(103,218,182,0.4)]"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
          <div className="text-center text-sm text-on-surface-variant mt-2">
            <span onClick={() => setViewMode('login')} className="text-primary font-bold hover:underline cursor-pointer">
              Back to Sign In
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[85vh] bg-transparent p-4">
      <div className="glass-panel animate-slide-in w-full max-w-[440px] p-8 rounded-2xl flex flex-col gap-6">
        
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent-blue mx-auto mb-4 flex items-center justify-center text-white text-2xl shadow-[0_0_15px_rgba(103,218,182,0.3)]">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Reliance Carpool Portal</h2>
          <p className="text-on-surface-variant text-sm mt-1">Sign in to access your dashboard</p>
        </div>
 
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {/* Role selector buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setRole('Passenger')}
              className={`flex-1 py-2.5 rounded-lg border font-bold text-sm transition-all duration-300 ${
                role === 'Passenger' 
                  ? 'bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(103,218,182,0.2)]' 
                  : 'bg-surface-container/50 text-on-surface-variant border-white/10 hover:bg-surface-bright/20'
              }`}
            >
              Passenger
            </button>
            <button
              type="button"
              onClick={() => setRole('Pool Host')}
              className={`flex-1 py-2.5 rounded-lg border font-bold text-sm transition-all duration-300 ${
                role === 'Pool Host' 
                  ? 'bg-tertiary/20 text-tertiary border-tertiary shadow-[0_0_10px_rgba(140,218,109,0.2)]' 
                  : 'bg-surface-container/50 text-on-surface-variant border-white/10 hover:bg-surface-bright/20'
              }`}
            >
              Pool Host
            </button>
            <button
              type="button"
              onClick={() => setRole('Admin')}
              className={`flex-1 py-2.5 rounded-lg border font-bold text-sm transition-all duration-300 ${
                role === 'Admin' 
                  ? 'bg-error-red/20 text-error border-error hover:bg-error-red/30' 
                  : 'bg-surface-container/50 text-on-surface-variant border-white/10 hover:bg-surface-bright/20'
              }`}
            >
              Admin
            </button>
          </div>
 
          {/* Email field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-on-surface-variant font-medium">Corporate Email</label>
            <input 
              type="email" 
              placeholder="e.g. rohan.s@ril.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full glass-input rounded-lg px-4 py-3 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
            />
          </div>
 
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <label className="text-sm text-on-surface-variant font-medium">Password</label>
              {role !== 'Admin' && (
                <span onClick={() => setViewMode('forgot')} className="text-xs text-primary font-bold hover:underline cursor-pointer">
                  Forgot?
                </span>
              )}
            </div>
            <input 
              type="password" 
              placeholder="Enter your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full glass-input rounded-lg px-4 py-3 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
            />
          </div>
 
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-98 ${
              role === 'Admin' 
                ? 'bg-gradient-to-r from-error-red to-error hover:shadow-[0_0_15px_rgba(229,57,53,0.4)]' 
                : 'bg-gradient-to-r from-primary to-accent-teal hover:shadow-[0_0_15px_rgba(103,218,182,0.4)]'
            }`}
          >
            {loading ? 'Authenticating...' : `Sign In as ${role}`}
          </button>
        </form>
 
        {role !== 'Admin' && (
          <div className="text-center text-sm text-on-surface-variant mt-2">
            Don't have an account?{' '}
            <span onClick={onRegisterClick} className="text-primary font-bold hover:underline cursor-pointer">
              Register here
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPortal;
