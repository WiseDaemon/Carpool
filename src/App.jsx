import React, { useState } from 'react';
import './index.css';
import MapComponent from './MapComponent';
import UserManagement from './UserManagement';
import ESGDashboard from './ESGDashboard';
import VerificationQueue from './VerificationQueue';
import Registration from './Registration';
import IncidentQueue from './IncidentQueue';
import TripsDashboard from './TripsDashboard';
import Settings from './Settings';
import UserPortal from './UserPortal';
import PassengerDashboard from './PassengerDashboard';
import PoolHostDashboard from './PoolHostDashboard';
import AppLayout from './AppLayout';
import { io } from 'socket.io-client';

// Live data will be fetched inside the App component.

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('carpool_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [toasts, setToasts] = useState([]);
  const [autoSelectPending, setAutoSelectPending] = useState(false);
  const [selectedCity, setSelectedCity] = useState('all');
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false); // Register without logging in

  const [dashboardData, setDashboardData] = useState({
    users: [],
    trips: [],
    incidents: []
  });

  React.useEffect(() => {
    if (!session) return;
    
    const socket = io(``);
    
    if (session.role === 'Admin') {
      socket.emit('join_admin');
      socket.on('sos_alert', (data) => {
        showToast(data.message, 'danger');
      });
    } else {
      socket.emit('join', session.id);
      socket.on('ride_requested', (data) => showToast(data.message, 'info'));
      socket.on('ride_accepted', (data) => showToast(data.message, 'success'));
      socket.on('ride_rejected', (data) => showToast(data.message, 'warning'));
      socket.on('location_update', (data) => {
        window.dispatchEvent(new CustomEvent('live_location', { detail: data }));
      });
      socket.on('ride_completed', () => {
        window.dispatchEvent(new CustomEvent('ride_completed'));
      });
    }

    return () => socket.disconnect();
  }, [session]);

  React.useEffect(() => {
    if (session && session.role === 'Admin' && activeTab === 'Overview') {
      const fetchAdminData = async () => {
        try {
          const token = session.token || localStorage.getItem('token');
          const headers = { 'Authorization': `Bearer ${token}` };
          const [usersRes, tripsRes, incidentsRes] = await Promise.all([
            fetch(`/api/users`, { headers }),
            fetch(`/api/trips`, { headers }),
            fetch(`/api/incidents`, { headers })
          ]);
          
          if (usersRes.ok && tripsRes.ok && incidentsRes.ok) {
            setDashboardData({
              users: await usersRes.json(),
              trips: await tripsRes.json(),
              incidents: await incidentsRes.json()
            });
          }
        } catch (err) {
          console.error("Failed to fetch admin data", err);
        }
      };
      fetchAdminData();
    }
  }, [session, activeTab]);

  const activeTripsCount = dashboardData.trips.filter(t => t.status === 'Scheduled').length;
  const totalUsersCount = dashboardData.users.length;
  const openSosCount = dashboardData.incidents.filter(i => i.status === 'Open').length;
  const verificationCount = dashboardData.users.filter(u => u.has_vehicle_pass === 0 && u.role === 'Pool Host').length;

  const kpiData = [
    { id: 1, title: 'Active Trips Now', value: activeTripsCount.toString(), trend: 'Live', isUp: true },
    { id: 2, title: 'Total Registered Users', value: totalUsersCount.toString(), trend: 'Live', isUp: true },
    { id: 3, title: 'Total Rides Listed', value: dashboardData.trips.length.toString(), trend: 'Live', isUp: true },
    { id: 4, title: 'Open SOS', value: openSosCount.toString(), trend: openSosCount === 0 ? 'Safe' : 'Action Req', isUp: openSosCount === 0 }, 
    { id: 5, title: 'Verification Backlog', value: verificationCount.toString(), trend: 'Pending', isUp: false },
  ];

  const incidentQueue = dashboardData.incidents.filter(i => i.status === 'Open').map(inc => ({
    id: `INC-${inc.id}`,
    user: inc.reporter_name || `User ${inc.reported_by}`,
    category: inc.type,
    status: 'Critical',
    time: new Date(inc.created_at).toLocaleTimeString()
  }));

  const verificationQueue = dashboardData.users.filter(u => u.has_vehicle_pass === 0 && u.role === 'Pool Host').map(u => ({
    id: `V-${u.id}`,
    name: u.name,
    type: 'Vehicle Pass',
    status: 'Pending',
    time: new Date(u.created_at).toLocaleDateString()
  }));

  const showToast = (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleLoginSuccess = (userObject) => {
    setSession(userObject);
    localStorage.setItem('carpool_session', JSON.stringify(userObject));
    setActiveTab('Overview');
    setShowRegistration(false);
  };

  const handleUpdateUser = (updatedUser) => {
    setSession(updatedUser);
    localStorage.setItem('carpool_session', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('carpool_session');
    showToast('Logged out successfully.', 'info');
  };

  const navItems = [
    { id: 'Overview', label: 'Overview', icon: '📊' },
    { id: 'Registration', label: 'Corporate Registration', icon: '📝' },
    { id: 'Verifications', label: 'Verification Backlog', icon: '🔍' },
    { id: 'Incidents', label: 'Live Incidents', icon: '🚨' },
    { id: 'Trips', label: 'Trips & Disputes', icon: '🚗' },
    { id: 'Users', label: 'User Directory', icon: '👥' },
    { id: 'ESG', label: 'ESG Impact Dashboard', icon: '🌱' },
    { id: 'Settings', label: 'Platform Settings', icon: '⚙️' }
  ];

  const handleCityChange = (e) => {
    const city = e.target.value;
    setSelectedCity(city);
    const cityName = city === 'all' ? 'All Cities' : city.charAt(0).toUpperCase() + city.slice(1);
    showToast(`Dashboard filtered to ${cityName}`, 'success');
  };

  const handleTodayClick = () => {
    const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    showToast(`Showing carpool data for ${todayStr}`, 'info');
  };

  const handleApproveVerification = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.token}` }
      });
      if (res.ok) {
        showToast('Host verified successfully!', 'success');
        // Refresh admin data
        const headers = { 'Authorization': `Bearer ${session.token}` };
        const [usersRes, tripsRes, incidentsRes] = await Promise.all([
          fetch(`/api/users`, { headers }),
          fetch(`/api/trips`, { headers }),
          fetch(`/api/incidents`, { headers })
        ]);
        if (usersRes.ok && tripsRes.ok && incidentsRes.ok) {
          setDashboardData({
            users: await usersRes.json(),
            trips: await tripsRes.json(),
            incidents: await incidentsRes.json()
          });
        }
      } else {
        showToast('Failed to verify host.', 'danger');
      }
    } catch (err) {
      showToast('Network error during verification.', 'danger');
    }
  };

  const handleResolveIncident = async (incidentId) => {
    try {
      const res = await fetch(`/api/incidents/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}` 
        },
        body: JSON.stringify({ incident_id: incidentId })
      });
      if (res.ok) {
        showToast('Incident resolved successfully.', 'success');
        // Refresh admin data
        const headers = { 'Authorization': `Bearer ${session.token}` };
        const [usersRes, tripsRes, incidentsRes] = await Promise.all([
          fetch(`/api/users`, { headers }),
          fetch(`/api/trips`, { headers }),
          fetch(`/api/incidents`, { headers })
        ]);
        if (usersRes.ok && tripsRes.ok && incidentsRes.ok) {
          setDashboardData({
            users: await usersRes.json(),
            trips: await tripsRes.json(),
            incidents: await incidentsRes.json()
          });
        }
      } else {
        showToast('Failed to resolve incident.', 'danger');
      }
    } catch (err) {
      showToast('Network error resolving incident.', 'danger');
    }
  };

  const toastElement = (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg transition-all duration-300 animate-slide-in ${
            toast.type === 'success' ? 'bg-primary/20 border-primary/30 text-primary' :
            toast.type === 'danger' ? 'bg-error-red/20 border-error-red/30 text-error-red' :
            toast.type === 'warning' ? 'bg-warning-orange/20 border-warning-orange/30 text-warning-orange' :
            'bg-accent-blue/20 border-accent-blue/30 text-accent-blue'
          }`}
        >
          <span className="material-symbols-outlined shrink-0">
            {toast.type === 'success' ? 'check_circle' :
             toast.type === 'danger' ? 'error' :
             toast.type === 'warning' ? 'warning' : 'info'}
          </span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-surface-base text-on-surface relative">
        {toastElement}

        {showRegistration ? (
          <div className="w-full max-w-[500px] flex flex-col gap-4">
            <button className="px-4 py-2 border border-white/10 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center gap-2 mb-2 font-bold text-sm self-start" onClick={() => setShowRegistration(false)}>
              ← Back to Unified Sign In
            </button>
            <Registration showToast={showToast} onLoginClick={() => setShowRegistration(false)} />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <UserPortal onLoginSuccess={handleLoginSuccess} onRegisterClick={() => setShowRegistration(true)} showToast={showToast} />
            <button className="mt-5 px-4 py-2.5 border border-white/10 hover:bg-white/10 text-white rounded-lg transition-colors font-bold text-sm" onClick={() => setShowRegistration(true)}>
              📝 Create New Employee Account
            </button>
          </div>
        )}
      </div>
    );
  }

  if (session.role === 'Passenger') {
    return (
      <>
        {toastElement}
        <PassengerDashboard user={session} onLogout={handleLogout} onUpdateUser={handleUpdateUser} showToast={showToast} />
      </>
    );
  }

  if (session.role === 'Pool Host') {
    return (
      <>
        {toastElement}
        <PoolHostDashboard user={session} onLogout={handleLogout} onUpdateUser={handleUpdateUser} showToast={showToast} />
      </>
    );
  }

  const adminNavItems = navItems.map(item => ({
    id: item.id,
    label: item.label,
    icon: item.id === 'Overview' ? 'dashboard' : 
          item.id === 'Registration' ? 'group_add' : 
          item.id === 'Verifications' ? 'verified_user' : 
          item.id === 'Incidents' ? 'warning' : 
          item.id === 'Trips' ? 'directions_car' : 
          item.id === 'Users' ? 'people' : 
          item.id === 'ESG' ? 'eco' : 'settings',
    isPrimaryAction: false,
    onClick: () => {
      setActiveTab(item.id);
      setAutoSelectPending(false);
    }
  }));

  return (
    <AppLayout 
      user={session} 
      onLogout={handleLogout} 
      onSettingsClick={() => setShowAdminProfile(true)} 
      notifications={dashboardData.incidents.filter(i => i.status === 'Open')} 
      onSosClick={() => {}} 
      navItems={adminNavItems} 
      activeNavId={activeTab}
    >
      <div className="flex flex-col gap-8 h-full">
        {/* Header */}
        {activeTab === 'Overview' ? (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-headline-xl text-headline-xl text-on-surface mb-2">Operations Hub</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">Real-time system metrics and administrative queue management.</p>
            </div>
            <div className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/20 px-4 py-2 rounded-full glass-panel">
              <span className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_8px_rgba(84,158,57,0.8)] animate-pulse"></span>
              <span className="font-label-md text-label-md text-accent-green uppercase tracking-wider">System Nominal</span>
            </div>
          </div>
        ) : (
          <header className="flex justify-between items-center py-2">
            <h1 className="text-2xl font-bold text-white">
              {navItems.find(item => item.id === activeTab)?.label || activeTab}
            </h1>
            <div className="flex gap-4">
              <select className="glass-input px-4 py-2 rounded-lg text-white outline-none" value={selectedCity} onChange={handleCityChange}>
                <option value="all">All Cities</option>
                <option value="mumbai">Mumbai</option>
                <option value="bangalore">Bangalore</option>
                <option value="navi-mumbai">Navi Mumbai</option>
              </select>
              <button className="btn-primary px-4 py-2 rounded-lg font-bold" onClick={handleTodayClick}>
                Today
              </button>
            </div>
          </header>
        )}

        {/* Content based on activeTab */}
        <div className="flex-1 overflow-y-auto">

        {activeTab === 'Overview' && (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* KPI 1: DAU */}
              <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/80 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-primary text-[28px]">group</span>
                  <div className="flex items-center gap-1 text-accent-green bg-accent-green/10 px-2 py-1 rounded text-xs font-medium">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span> +12.5%
                  </div>
                </div>
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">Daily Active Users</p>
                  <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{(4200 + totalUsersCount).toLocaleString()}</h3>
                </div>
              </div>

              {/* KPI 2: CO2 Saved */}
              <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/80 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 rounded-full blur-[40px] -mr-10 -mt-10 group-hover:bg-accent-blue/10 transition-colors"></div>
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-accent-blue text-[28px]">eco</span>
                  <div className="flex items-center gap-1 text-accent-green bg-accent-green/10 px-2 py-1 rounded text-xs font-medium">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span> +8.2%
                  </div>
                </div>
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">CO₂ Saved (kg)</p>
                  <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{(12000 + dashboardData.trips.length * 15).toLocaleString()}</h3>
                </div>
              </div>

              {/* KPI 3: Active Rides Now */}
              <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/80 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-[40px] -mr-10 -mt-10 group-hover:bg-secondary/10 transition-colors"></div>
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-secondary text-[28px]">directions_car</span>
                  <div className="flex items-center gap-1 text-on-surface-variant bg-surface-bright/30 px-2 py-1 rounded text-xs font-medium">
                    Stable
                  </div>
                </div>
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">Active Rides Now</p>
                  <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{activeTripsCount}</h3>
                </div>
              </div>

              {/* KPI 4: Pending Verifications */}
              <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/80 transition-all duration-300 border-warning-orange/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-warning-orange/5 rounded-full blur-[40px] -mr-10 -mt-10 group-hover:bg-warning-orange/10 transition-colors"></div>
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-warning-orange text-[28px]">how_to_reg</span>
                  <div className={`flex items-center gap-1 ${verificationCount > 0 ? 'text-warning-orange bg-warning-orange/10' : 'text-accent-green bg-accent-green/10'} px-2 py-1 rounded text-xs font-medium`}>
                    {verificationCount > 0 ? 'Needs Action' : 'Cleared'}
                  </div>
                </div>
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">Pending Verifications</p>
                  <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{verificationCount}</h3>
                </div>
              </div>
            </div>

            {/* Split Data Section */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-8">
              {/* Verification Queue (8 cols) */}
              <div className="xl:col-span-8 glass-panel rounded-xl flex flex-col h-[600px] overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surface-base/30">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">policy</span>
                    <h3 className="font-headline-md text-headline-md text-on-surface">Verification Queue</h3>
                  </div>
                  <button onClick={() => setActiveTab('Verifications')} className="text-primary hover:text-primary-fixed-dim font-label-md text-label-md transition-colors flex items-center gap-1">
                    View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {dashboardData.users.filter(u => u.has_vehicle_pass === 0 && u.role === 'Pool Host').map(u => (
                    <div key={u.id} className="p-4 rounded-lg hover:bg-surface-bright/20 transition-colors flex items-center justify-between group border border-transparent hover:border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-surface-bright border border-white/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-label-lg text-label-lg text-on-surface">{u.name}</h4>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            Host • {u.vehicle_make || 'N/A'} {u.vehicle_model || ''} ({u.vehicle_no || 'N/A'})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                          <span className="font-label-md text-label-md text-on-surface-variant">Docs Submitted</span>
                          <span className="font-body-sm text-body-sm text-warning-orange flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">pending_actions</span> Pending Review
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            showToast(`Verification for ${u.name} rejected.`, 'danger');
                          }} className="w-10 h-10 rounded-full border border-error-red/30 text-error-red hover:bg-error-red/10 flex items-center justify-center transition-colors" title="Reject">
                            <span className="material-symbols-outlined">close</span>
                          </button>
                          <button onClick={() => handleApproveVerification(u.id)} className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg font-label-md text-label-md hover:bg-primary hover:text-surface-deep transition-all flex items-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">check</span> Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dashboardData.users.filter(u => u.has_vehicle_pass === 0 && u.role === 'Pool Host').length === 0 && (
                    <div className="text-on-surface-variant italic text-center p-8">No pending verifications.</div>
                  )}
                </div>
              </div>

              {/* Incidents Management (4 cols) */}
              <div className="xl:col-span-4 glass-panel rounded-xl flex flex-col h-[600px] border-l-4 border-l-surface-bright/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-error-red/50 to-transparent"></div>
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surface-base/30">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-error-red">warning</span>
                    <h3 className="font-headline-md text-headline-md text-on-surface">Active Alerts</h3>
                  </div>
                  <div className="bg-error-red/20 text-error-red px-2 py-0.5 rounded-full font-label-md text-label-md border border-error-red/30">
                    {dashboardData.incidents.filter(i => i.status === 'Open').length} Open
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {dashboardData.incidents.filter(i => i.status === 'Open').map(inc => (
                    <div key={inc.id} className="bg-surface-base border border-error-red/30 rounded-lg p-4 relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-error-red"></div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-error-red font-label-md text-label-md">
                          <span className="material-symbols-outlined text-[16px]">sos</span> SOS Triggered
                        </div>
                        <span className="text-on-surface-variant text-xs">At: {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <h4 className="font-label-lg text-label-lg text-on-surface mb-1">Reporter: {inc.reporter_name || `User #${inc.reported_by}`}</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">Type: {inc.type}</p>
                      <button onClick={() => handleResolveIncident(inc.id)} className="w-full bg-error-red/10 text-error-red border border-error-red/30 py-2 rounded font-label-md text-label-md hover:bg-error-red hover:text-white transition-colors">
                        Investigate & Resolve
                      </button>
                    </div>
                  ))}
                  {dashboardData.incidents.filter(i => i.status === 'Open').length === 0 && (
                    <div className="text-on-surface-variant italic text-center p-8">No active incidents.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'UserPortal' && (
          <UserPortal showToast={showToast} />
        )}

        {activeTab === 'Verifications' && (
          <VerificationQueue showToast={showToast} autoSelectPending={autoSelectPending} />
        )}

        {activeTab === 'Users' && (
          <UserManagement showToast={showToast} token={session.token || localStorage.getItem('token')} />
        )}

        {activeTab === 'ESG' && (
          <ESGDashboard />
        )}

        {activeTab === 'Registration' && (
          <Registration showToast={showToast} />
        )}

        {activeTab === 'Incidents' && (
          <IncidentQueue showToast={showToast} />
        )}

        {activeTab === 'Trips' && (
          <TripsDashboard showToast={showToast} session={session} />
        )}

        {activeTab === 'Settings' && (
          <Settings showToast={showToast} />
        )}
        </div>

        {/* Admin Profile Modal */}
        {showAdminProfile && (
          <div className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-4" onClick={() => setShowAdminProfile(false)}>
            <div className="glass-panel w-full max-w-md p-8 rounded-xl border border-white/10 relative flex flex-col gap-6 animate-slide-in" onClick={(e) => e.stopPropagation()}>
              <button className="absolute top-4 right-4 text-on-surface-variant hover:text-white text-2xl transition-colors" onClick={() => setShowAdminProfile(false)}>&times;</button>
              <h3 className="text-xl font-bold text-white border-b border-white/10 pb-3">
                System Administrator Profile
              </h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center text-white text-2xl font-bold">
                    A
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white leading-tight">Admin Commute Controller</h4>
                    <span className="inline-block px-2 py-0.5 rounded text-xs mt-2 bg-primary/20 text-primary border border-primary/30 font-semibold">
                      Platform Admin
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 bg-surface-container/30 border border-white/5 p-5 rounded-xl text-sm">
                  <div>
                    <span className="text-xs text-on-surface-variant font-medium">Corporate Email</span>
                    <div className="font-semibold text-white mt-1">admin.carpool@reliance.com</div>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant font-medium">Security Clearance</span>
                    <div className="font-semibold text-error-red mt-1">Level 3 (ERT Dispatch Access)</div>
                  </div>
                  <div>
                    <span className="text-xs text-on-surface-variant font-medium">Role Duties</span>
                    <div className="text-on-surface-variant mt-1 leading-relaxed">
                      Manages platform parameters, verifies driver documentation, tracks live commute disputes, and responds to real-time SOS security triggers.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default App;
