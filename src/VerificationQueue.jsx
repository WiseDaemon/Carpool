import React, { useState, useEffect } from 'react';

const VerificationQueue = ({ showToast, autoSelectPending }) => {
  const [queue, setQueue] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const fetchPendingVerifications = async () => {
    try {
      const res = await fetch(`/api/users`);
      if (res.ok) {
        const users = await res.json();
        const pendingDrivers = users.filter(u => u.role === 'Pool Host' && u.has_vehicle_pass === 0);
        setQueue(pendingDrivers.map(u => ({
          id: `V-${u.id}`,
          db_id: u.id,
          name: u.name,
          type: 'Vehicle Pass',
          status: 'Pending',
          time: new Date(u.created_at).toLocaleDateString(),
          vehicle_no: u.vehicle_no,
          vehicle_make: u.vehicle_make,
          vehicle_model: u.vehicle_model,
          emp_id: u.emp_id,
          confidence: 'Manual'
        })));
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to load verification queue.', 'danger');
    }
  };

  useEffect(() => {
    fetchPendingVerifications();
  }, []);

  useEffect(() => {
    if (autoSelectPending && queue.length > 0) {
      const firstPending = queue.find(item => item.status === 'Pending');
      if (firstPending) {
        setSelectedDoc(firstPending);
      }
    }
  }, [autoSelectPending, queue.length]);

  const handleAction = async (db_id, action) => {
    if (action === 'approve') {
      try {
        const res = await fetch(`/api/users/${db_id}/verify`, { method: 'POST' });
        if (res.ok) {
          if (showToast) showToast(`User successfully verified.`, 'success');
          fetchPendingVerifications();
          setSelectedDoc(null);
        } else {
          if (showToast) showToast(`Failed to verify user.`, 'danger');
        }
      } catch (err) {
        if (showToast) showToast(`Network error validating user.`, 'danger');
      }
    } else {
      setQueue(queue.filter(q => q.db_id !== db_id));
      setSelectedDoc(null);
      if (showToast) showToast(`Verification rejected.`, 'danger');
    }
  };

  const pendingCount = queue.filter(q => q.status === 'Pending').length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-slide-in">
      
      {/* Queue List */}
      <div className="glass-panel flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Verification Backlog</h2>
          <span className="bg-warning-orange/20 text-warning-orange px-3 py-1 rounded-full text-xs font-semibold border border-warning-orange/30">{pendingCount} Pending</span>
        </div>

        {queue.length === 0 ? (
          <div className="text-on-surface-variant italic text-center py-10">
            No pending verifications at this time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-on-surface-variant text-sm">
                  <th className="pb-3 font-semibold">Req ID</th>
                  <th className="pb-3 font-semibold">Employee Name</th>
                  <th className="pb-3 font-semibold">Doc Type</th>
                  <th className="pb-3 font-semibold">Vehicle No</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => (
                  <tr key={item.id} className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${selectedDoc?.id === item.id ? 'bg-white/5' : ''}`} onClick={() => setSelectedDoc(item)}>
                    <td className="py-3 font-bold text-white"><strong>{item.id}</strong></td>
                    <td className="py-3 text-white">{item.name}</td>
                    <td className="py-3 text-on-surface-variant">{item.type}</td>
                    <td className="py-3 text-on-surface-variant uppercase">{item.vehicle_no || 'N/A'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${item.status === 'Approved' ? 'bg-primary/20 text-primary border border-primary/30' : item.status === 'Rejected' ? 'bg-error-red/20 text-error-red border border-error-red/30' : 'bg-warning-orange/20 text-warning-orange border border-warning-orange/30'}`}>
                        {item.status === 'Pending' ? `Waiting` : item.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button 
                        className="border border-white/10 hover:bg-white/10 text-white px-3 py-1 rounded text-xs transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDoc(item);
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Panel */}
      {selectedDoc ? (
        <div className="glass-panel w-full lg:w-[400px] p-6 flex flex-col gap-5 animate-slide-in shrink-0">
          <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3">Review Document</h3>
          
          <div className="bg-surface-container/50 border border-white/5 rounded-xl p-5 flex flex-col gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Applicant</div>
              <div className="text-body-lg text-white font-medium">{selectedDoc.name}</div>
            </div>
            
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Employee ID</div>
              <div className="text-body-md text-white">{selectedDoc.emp_id}</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Vehicle Plate</div>
              <div className="text-body-md text-white uppercase">{selectedDoc.vehicle_no || 'Not Provided'}</div>
            </div>
          </div>

          <div className="flex-1 bg-surface-base rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center min-h-[200px] p-5 gap-2">
            <span className="text-4xl">🚗</span>
            <span className="text-white font-bold text-lg">{selectedDoc.vehicle_make} {selectedDoc.vehicle_model}</span>
            <span className="text-on-surface-variant text-xs">[ Vehicle Verification ]</span>
          </div>

          {selectedDoc.status === 'Pending' ? (
             <div className="flex gap-3 mt-4">
                <button className="flex-1 border border-error-red/30 text-error-red hover:bg-error-red/10 font-bold py-2.5 rounded-lg transition-all" onClick={() => handleAction(selectedDoc.db_id, 'reject')}>Reject</button>
                <button className="flex-1 bg-primary text-on-primary-fixed font-bold py-2.5 rounded-lg hover:shadow-[0_0_15px_rgba(103,218,182,0.4)] hover:scale-[1.02] transition-all" onClick={() => handleAction(selectedDoc.db_id, 'approve')}>Approve</button>
             </div>
          ) : (
            <div className={`text-center py-3 rounded-lg border ${selectedDoc.status === 'Approved' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-error-red/10 text-error-red border-error-red/30'}`}>
              Document has been {selectedDoc.status.toLowerCase()}.
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel w-full lg:w-[400px] p-6 flex items-center justify-center text-center">
          <div className="text-on-surface-variant">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-50">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Select a document from the backlog to review.
          </div>
        </div>
      )}

    </div>
  );
};

export default VerificationQueue;
