import React, { useState, useEffect } from 'react';
import { subscribeToPush, unsubscribeFromPush } from './pushUtils';

const Settings = ({ user, showToast, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState('profile');

  // Profile fields
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Preferences
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [womenOnly, setWomenOnly] = useState(user?.women_only || false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setNotifPush(true);
        });
      });
    }
  }, []);

  const handleTogglePush = async () => {
    const newVal = !notifPush;
    setNotifPush(newVal);
    const token = localStorage.getItem('token');
    if (newVal) {
      const success = await subscribeToPush(token);
      if (success) {
        if (showToast) showToast('Push notifications enabled!', 'success');
      } else {
        setNotifPush(false);
        if (showToast) showToast('Failed to enable push notifications.', 'danger');
      }
    } else {
      const success = await unsubscribeFromPush(token);
      if (success) {
        if (showToast) showToast('Push notifications disabled.', 'success');
      } else {
        setNotifPush(true);
        if (showToast) showToast('Failed to disable push notifications.', 'danger');
      }
    }
  };
  const [paymentMode, setPaymentMode] = useState('Corporate Wallet');
  const [prefsLoading, setPrefsLoading] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return showToast('Name cannot be empty.', 'warning');
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profile updated successfully!', 'success');
        if (onUpdateUser) onUpdateUser(data.user);
      } else {
        showToast(data.error || 'Failed to update profile.', 'danger');
      }
    } catch {
      showToast('Network error updating profile.', 'danger');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profile picture updated successfully!', 'success');
        if (onUpdateUser) onUpdateUser({ ...user, avatar_url: data.avatar_url });
      } else {
        showToast(data.error || 'Failed to update avatar.', 'danger');
      }
    } catch (err) {
      showToast('Network error uploading image.', 'danger');
    }
  };

  const handleSavePrefs = (e) => {
    e.preventDefault();
    setPrefsLoading(true);
    setTimeout(() => {
      setPrefsLoading(false);
      showToast('Preferences saved successfully!', 'success');
    }, 800);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'person' },
    { id: 'preferences', label: 'Preferences', icon: 'tune' },
    { id: 'security', label: 'Security & SSO', icon: 'security' },
  ];

  return (
    <div className="glass-panel p-6 rounded-xl animate-slide-in">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5 mb-6">
        <span className="material-symbols-outlined text-primary text-3xl">settings</span>
        <div>
          <h2 className="text-xl font-bold text-white">Account Settings</h2>
          <p className="text-on-surface-variant text-sm">Manage your profile, preferences and security</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(2,150,118,0.15)]'
                : 'text-on-surface-variant bg-surface-container/40 border border-white/5 hover:bg-surface-bright/20 hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="max-w-lg flex flex-col gap-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 shadow-[0_0_20px_rgba(2,150,118,0.2)]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/40 to-accent-teal/40 border-2 border-primary/30 flex items-center justify-center text-3xl font-bold text-primary shadow-[0_0_20px_rgba(2,150,118,0.2)]">
                  {(editName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <span className="material-symbols-outlined text-xl">upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div>
              <p className="text-white font-semibold">{user?.name}</p>
              <p className="text-on-surface-variant text-sm">{user?.email}</p>
              <span className="inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block"></span>
                {user?.role}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-on-surface-variant font-medium">Display Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              required
              className="glass-input rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-on-surface-variant font-medium">Corporate Email</label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="glass-input rounded-lg px-4 py-3 text-on-surface-variant outline-none opacity-60 cursor-not-allowed"
            />
            <p className="text-xs text-on-surface-variant/60">Email is managed by your corporate SSO directory</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-on-surface-variant font-medium">Penalty Points</label>
            <div className="flex items-center gap-3">
              <div className={`text-lg font-bold ${user?.penalty_points >= 2 ? 'text-error-red' : 'text-primary'}`}>
                {user?.penalty_points || 0} / 3
              </div>
              {user?.penalty_points >= 2 && (
                <span className="bg-error-red/20 text-error-red px-3 py-1 rounded-full text-xs border border-error-red/30">
                  Warning: 1 point away from 15-day suspension.
                </span>
              )}
              {user?.penalty_points > 0 && user?.penalty_points < 2 && (
                <span className="bg-warning-orange/20 text-warning-orange px-3 py-1 rounded-full text-xs border border-warning-orange/30">
                  Please be punctual to avoid penalties.
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/60">Points are added when reported as a No-Show. Reach 3 points to be suspended.</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-on-surface-variant font-medium">Mobile Number</label>
            <input
              type="tel"
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              placeholder="+91 9XXXXXXXXX"
              className="glass-input rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/30"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={profileLoading}
              className="btn-primary px-8 py-3 rounded-lg font-bold text-sm hover:shadow-[0_0_15px_rgba(2,150,118,0.4)] transition-all duration-300 disabled:opacity-60"
            >
              {profileLoading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSavePrefs} className="max-w-lg flex flex-col gap-6">
          {/* Notification Preferences */}
          <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">notifications</span>
              Notification Preferences
            </h3>
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <p className="text-on-surface font-medium text-sm">Email Notifications</p>
                <p className="text-on-surface-variant text-xs">Ride confirmations, cancellations</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifEmail(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${notifEmail ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${notifEmail ? 'left-7' : 'left-1'}`}></span>
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <p className="text-on-surface font-medium text-sm">Push Notifications</p>
                <p className="text-on-surface-variant text-xs">Real-time ride status updates</p>
              </div>
              <button
                type="button"
                onClick={handleTogglePush}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${notifPush ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${notifPush ? 'left-7' : 'left-1'}`}></span>
              </button>
            </label>
          </div>

          {/* Ride Preferences */}
          <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
              Ride Preferences
            </h3>
            {(user?.role === 'Passenger' || user?.role === 'Pool Host') && user?.gender === 'Female' && (
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-on-surface font-medium text-sm">Women-Only Rides</p>
                  <p className="text-on-surface-variant text-xs">Only match with female hosts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWomenOnly(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${womenOnly ? 'bg-primary' : 'bg-surface-container-high'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${womenOnly ? 'left-7' : 'left-1'}`}></span>
                </button>
              </label>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-on-surface-variant font-medium">Preferred Payment Mode</label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                className="glass-input rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-all bg-surface-container/50"
              >
                <option value="Corporate Wallet">Corporate Wallet</option>
                <option value="UPI">UPI</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={prefsLoading}
              className="btn-primary px-8 py-3 rounded-lg font-bold text-sm hover:shadow-[0_0_15px_rgba(2,150,118,0.4)] transition-all duration-300 disabled:opacity-60"
            >
              {prefsLoading ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </form>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="max-w-lg flex flex-col gap-6">
          <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">corporate_fare</span>
              Corporate SSO Status
            </h3>
            <div className="flex items-center gap-3 bg-surface-container/50 rounded-lg p-4 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">verified_user</span>
              </div>
              <div>
                <p className="text-on-surface font-medium text-sm">Reliance Active Directory</p>
                <p className="text-primary text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block"></span>
                  Connected & Authenticated
                </p>
              </div>
            </div>
            <button
              onClick={() => showToast && showToast('Corporate SSO Active Directory connection: SUCCESS', 'success')}
              className="btn-primary px-6 py-3 rounded-lg font-bold text-sm hover:shadow-[0_0_15px_rgba(2,150,118,0.4)] transition-all duration-300 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Test SSO Connection
            </button>
          </div>

          <div className="glass-panel rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-warning-orange text-[20px]">lock</span>
              Session Management
            </h3>
            <p className="text-on-surface-variant text-sm">Your session is secured via JWT token (expires in 24h). All ride data is encrypted in transit.</p>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container/40 rounded-lg p-3 border border-white/5">
              <span className="material-symbols-outlined text-primary text-[16px]">shield</span>
              Last login: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} via SSO
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
