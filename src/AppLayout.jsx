import React, { useState, useRef, useEffect } from 'react';

const AppLayout = ({ user, onLogout, onSettingsClick, notifications = [], onSosClick, navItems, activeNavId, children }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [registeredRoles, setRegisteredRoles] = useState([]);
  const profileRef = useRef(null);

  useEffect(() => {
    if (user?.email) {
      const token = user.token || localStorage.getItem('token');
      fetch(`/api/users/roles?email=${encodeURIComponent(user.email)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) setRegisteredRoles(data);
        })
        .catch(err => console.error('Failed to fetch user roles', err));
    }
  }, [user?.email]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-surface-base text-on-surface min-h-screen font-body-md text-body-md overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      
      {/* SideNavBar (Desktop) */}
      <aside className="fixed left-0 top-0 h-full z-40 bg-surface-deep dark:bg-surface-deep border-r border-white/10 bg-glass-fill backdrop-blur-lg shadow-2xl shadow-black hidden lg:flex flex-col w-[280px]">
        <div className="p-6 pb-8 border-b border-white/5">
          <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-primary mb-1 mt-2">Employee Portal</h1>
          <p className="font-label-lg text-label-lg text-on-surface-variant">Secure Corporate Network</p>
        </div>
        
        <nav className="flex-1 py-6 flex flex-col gap-2 overflow-y-auto">
          {navItems.filter(item => !item.isPrimaryAction).map(item => (
            <button 
              key={item.id} 
              onClick={item.onClick}
              className={`flex items-center gap-3 px-6 py-4 transition-all duration-300 w-full text-left ${activeNavId === item.id ? 'bg-primary/10 text-primary border-r-4 border-primary translate-x-1' : 'text-on-surface-variant hover:bg-surface-bright/10 hover:text-on-surface hover:backdrop-brightness-125'}`}
            >
              <span className="material-symbols-outlined" data-weight={activeNavId === item.id ? "fill" : ""}>{item.icon}</span>
              <span className="font-label-lg text-label-lg">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          {navItems.filter(item => item.isPrimaryAction).map(item => (
            <button 
              key={item.id} 
              onClick={item.onClick}
              className="w-full bg-primary text-on-primary-container font-label-lg text-label-lg py-3 rounded-lg mb-6 hover:shadow-[0_0_15px_rgba(2,150,118,0.4)] hover:scale-[1.02] transition-all duration-300 flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className="flex flex-col gap-2">
            <button onClick={onSettingsClick} className="flex items-center gap-3 text-on-surface-variant px-4 py-2 hover:bg-surface-bright/10 hover:text-on-surface rounded-lg transition-all duration-300 w-full text-left">
              <span className="material-symbols-outlined" style={{fontSize: '20px'}}>settings</span>
              <span className="font-label-lg text-label-lg">Settings</span>
            </button>
            <button onClick={onLogout} className="flex items-center gap-3 text-on-surface-variant px-4 py-2 hover:bg-error-red/20 hover:text-error-red rounded-lg transition-all duration-300 w-full text-left">
              <span className="material-symbols-outlined" style={{fontSize: '20px'}}>logout</span>
              <span className="font-label-lg text-label-lg">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="pb-24 lg:pb-8 lg:pl-[280px] min-h-screen">
        {/* Header Elements Row (Inline flow, no background bar) */}
        <div className="flex justify-between items-center w-full px-6 lg:px-10 py-4">
          <div className="flex items-center gap-4 flex-1">
            <span className="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary tracking-tight lg:hidden">Reliance RideShare</span>
            <div className="hidden lg:flex items-center bg-surface-container border border-outline-variant/50 rounded-full px-4 py-2 w-64 focus-within:border-primary focus-within:shadow-[0_0_10px_rgba(2,150,118,0.2)] transition-all">
              <span className="material-symbols-outlined text-on-surface-variant mr-2" style={{ fontSize: '20px' }}>search</span>
              <input className="bg-transparent border-none outline-none text-body-sm text-on-surface placeholder-on-surface-variant w-full focus:ring-0 p-0" placeholder="Search destinations..." type="text"/>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-on-surface-variant hover:text-on-surface transition-colors hover:bg-surface-bright/20 p-2 rounded-full duration-300 relative group">
              <span className="material-symbols-outlined">notifications</span>
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse"></span>}
            </button>
            <button onClick={onSosClick} className="text-on-surface-variant hover:text-error-red transition-colors hover:bg-error-red/10 p-2 rounded-full duration-300">
              <span className="material-symbols-outlined">emergency_home</span>
            </button>
            <div className="relative" ref={profileRef}>
              <div 
                className="h-8 w-8 rounded-full bg-surface-container-high border border-outline/30 flex items-center justify-center font-bold overflow-hidden ml-2 cursor-pointer hover:border-primary transition-colors text-primary text-sm"
                onClick={() => setShowProfile(!showProfile)}
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0)
                )}
              </div>
              
              {showProfile && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-64 bg-surface-container-high border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-slide-in">
                  <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg overflow-hidden">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        user?.name?.charAt(0)
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold text-white text-sm truncate">{user?.name}</p>
                      <p className="text-on-surface-variant text-xs truncate">{user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant">Registered as:</span>
                      <span className="font-medium text-white">{registeredRoles.length > 0 ? registeredRoles.join(', ') : user?.role}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant">Logged in as:</span>
                      <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">{user?.role}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setShowProfile(false);
                      if (onSettingsClick) onSettingsClick();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:bg-white/5 hover:text-white rounded transition-colors flex items-center gap-2 mb-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    Manage Account
                  </button>
                  <button 
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-error-red hover:bg-error-red/10 rounded transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 lg:px-10">
          {children}
        </div>
      </main>

      {/* BottomNavBar (Mobile) */}
      <nav className="fixed w-full bottom-0 lg:hidden rounded-t-xl bg-surface-container dark:bg-surface-container backdrop-blur-lg border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] z-50 flex justify-around items-center px-4 py-3">
        {navItems.filter(item => !item.isPrimaryAction).map(item => (
          <button 
            key={item.id} 
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center px-4 py-2 transition-all duration-200 ${activeNavId === item.id ? 'text-primary bg-primary/10 rounded-xl scale-90' : 'text-on-surface-variant active:bg-surface-bright/20'}`}
          >
            <span className="material-symbols-outlined" data-weight={activeNavId === item.id ? "fill" : ""}>{item.icon}</span>
            <span className="font-label-md text-label-md mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;
