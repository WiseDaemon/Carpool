import React, { useState, useEffect } from 'react';

const UserManagement = ({ showToast, token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showToast('Failed to fetch user directory.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error loading user directory.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleStatus = async (userId, userName) => {
    try {
      const res = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`User ${userName} status updated to ${data.status}.`, data.status === 'Active' ? 'success' : 'danger');
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to update user status.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error updating user status.', 'danger');
    }
  };

  const forgivePenalty = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to forgive penalty points for ${userName}?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}/reset-penalty`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`Penalty points forgiven for ${userName}.`, 'success');
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to forgive penalty.', 'danger');
      }
    } catch (e) {
      showToast('Network error forgiving penalty.', 'danger');
    }
  };

  const promoteToAdmin = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to promote ${userName} to Admin?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}/assign-admin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`User ${userName} successfully promoted to Admin.`, 'success');
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to promote user.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error promoting user.', 'danger');
    }
  };

  const handleExportData = () => {
    try {
      const headers = ['Employee ID', 'Name', 'Email', 'Gender', 'Role', 'Status', 'Joined Date', 'Vehicle No', 'Make', 'Model', 'Capacity'];
      const rows = users.map(u => [
        `EMP-${u.id}`, 
        u.name, 
        u.email, 
        u.gender || 'N/A',
        u.role, 
        u.status, 
        new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        u.vehicle_no || 'N/A',
        u.vehicle_make || 'N/A',
        u.vehicle_model || 'N/A',
        u.vehicle_capacity || 'N/A'
      ]);
      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `reliance_carpool_users_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(`Exported ${users.length} user records to CSV successfully!`, 'success');
    } catch (e) {
      showToast('Failed to export CSV data.', 'danger');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    `EMP-${u.id}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="glass-panel flex flex-col p-6 animate-slide-in">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-xl font-bold text-white">User Directory</h2>
        <div className="flex gap-4 flex-wrap">
          <input 
            type="text" 
            placeholder="Search by name, email, or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-input rounded-lg px-4 py-2 text-white placeholder:text-on-surface-variant/30 outline-none text-body-sm focus:border-primary transition-all w-64"
          />
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-[0_0_10px_rgba(2,150,118,0.2)]" onClick={handleExportData} disabled={users.length === 0}>Export Data</button>
        </div>
      </div>

      {loading ? (
        <div className="text-on-surface-variant italic text-center py-10">
          Loading user records from database...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-on-surface-variant text-sm">
                <th className="pb-3 font-semibold">Employee ID</th>
                <th className="pb-3 font-semibold">Name</th>
                <th className="pb-3 font-semibold">Email</th>
                <th className="pb-3 font-semibold">Gender</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Joined Date</th>
                <th className="pb-3 font-semibold">Penalty Pts</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 font-bold text-white">EMP-{user.id}</td>
                  <td className="py-3 text-white">{user.name}</td>
                  <td className="py-3 text-on-surface-variant">{user.email}</td>
                  <td className="py-3 text-on-surface-variant">{user.gender || 'N/A'}</td>
                  <td className="py-3 text-on-surface-variant">{user.role}</td>
                  <td className="py-3 text-on-surface-variant">
                    {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3">
                    <span className={`font-bold ${user.penalty_points >= 2 ? 'text-error-red' : (user.penalty_points === 1 ? 'text-warning-orange' : 'text-on-surface-variant')}`}>
                      {user.penalty_points || 0}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${user.status === 'Active' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-error-red/20 text-error-red border border-error-red/30'}`}>
                      {user.status || 'Active'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button className="border border-white/10 hover:bg-white/10 text-white px-3 py-1 rounded text-xs transition-colors" onClick={() => setSelectedUser(user)}>View</button>
                      {user.penalty_points > 0 && (
                        <button 
                          className="border border-warning-orange/30 hover:bg-warning-orange/20 text-warning-orange px-3 py-1 rounded text-xs transition-colors" 
                          onClick={() => forgivePenalty(user.id, user.name)}
                        >
                          Forgive
                        </button>
                      )}
                      {user.role !== 'Admin' && (
                        <button 
                          className="border border-white/10 hover:bg-tertiary/20 text-tertiary px-3 py-1 rounded text-xs transition-colors" 
                          onClick={() => promoteToAdmin(user.id, user.name)}
                        >
                          Promote to Admin
                        </button>
                      )}
                      <button 
                        className={`px-3 py-1 rounded text-xs font-bold transition-all border ${
                          user.status === 'Active' 
                            ? 'border-error-red/30 text-error-red hover:bg-error-red/10' 
                            : 'bg-primary/20 text-primary border-primary hover:bg-primary'
                        }`}
                        onClick={() => toggleStatus(user.id, user.name)}
                      >
                        {user.status === 'Active' ? 'Suspend' : 'Reinstate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-on-surface-variant italic text-center py-10">
                    No live users found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="glass-panel w-full max-w-lg p-8 rounded-2xl relative flex flex-col gap-6 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-on-surface-variant hover:text-white text-2xl transition-colors" onClick={() => setSelectedUser(null)}>&times;</button>
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3">
              Employee Profile Details
            </h3>
            
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center text-white text-2xl font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white leading-tight">{selectedUser.name}</h4>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs mt-2 ${selectedUser.status === 'Active' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-error-red/20 text-error-red border border-error-red/30'}`}>
                    {selectedUser.status || 'Active'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-container/30 border border-white/5 p-5 rounded-xl text-sm">
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Employee ID</span>
                  <div className="font-semibold text-white mt-1">EMP-{selectedUser.id}</div>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Corporate Email</span>
                  <div className="font-semibold text-white mt-1">{selectedUser.email}</div>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Gender</span>
                  <div className="font-semibold text-white mt-1">{selectedUser.gender || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Registered Role</span>
                  <div className="font-semibold text-white mt-1">{selectedUser.role}</div>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Joined Date</span>
                  <div className="font-semibold text-white mt-1">
                    {new Date(selectedUser.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              
              {selectedUser.role === 'Pool Host' && (
                <div className="bg-tertiary/5 border border-tertiary/20 p-5 rounded-xl text-sm">
                  <h5 className="text-tertiary font-bold text-md mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Vehicle Information
                  </h5>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    <div>
                      <span className="text-xs text-on-surface-variant font-medium">Vehicle Make/Model</span>
                      <div className="text-white mt-0.5">{selectedUser.vehicle_make || 'N/A'} {selectedUser.vehicle_model || ''}</div>
                    </div>
                    <div>
                      <span className="text-xs text-on-surface-variant font-medium">Registration No.</span>
                      <div className="text-white uppercase mt-0.5">{selectedUser.vehicle_no || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-on-surface-variant font-medium">Capacity</span>
                      <div className="text-white mt-0.5">{selectedUser.vehicle_capacity || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-on-surface-variant font-medium">Gate Pass Status</span>
                      <div className={`mt-0.5 font-semibold ${selectedUser.has_vehicle_pass ? 'text-primary' : 'text-error-red'}`}>
                        {selectedUser.has_vehicle_pass ? 'Valid Pass Assigned' : 'No Active Pass'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
