import React, { useState, useEffect } from 'react';

const IncidentQueue = ({ showToast }) => {
  const [incidents, setIncidents] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`/api/incidents`);
      const data = await res.json();
      setIncidents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResolve = async (id) => {
    try {
      const res = await fetch(`/api/incidents/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: id })
      });
      if (res.ok) {
        if (showToast) showToast(`Incident #${id} has been marked as Resolved.`, 'success');
        fetchIncidents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEscalate = async (id) => {
    try {
      const res = await fetch(`/api/incidents/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: id })
      });
      if (res.ok) {
        if (showToast) showToast(`🚨 Emergency Response Team (ERT) dispatched for Incident #${id}!`, 'danger');
        fetchIncidents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl animate-slide-in">
      <h2 className="text-xl font-bold text-white border-b border-white/10 pb-4 mb-6">Live Incident Management (SOS Alerts)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {incidents.map(inc => {
          const slaTime = new Date(inc.sla_deadline);
          const diffMs = slaTime - currentTime;
          const isBreached = diffMs <= 0 && inc.status !== 'Resolved' && inc.status !== 'Escalated';
          const minsLeft = Math.ceil(diffMs / 60000);
          
          let cardBgClass = "bg-surface-container/30 border-white/5";
          let borderHighlightClass = "border";
          
          if (inc.status === 'Escalated') {
            cardBgClass = "bg-error-red/5 border-error-red/20";
            borderHighlightClass = "border-l-4 border-l-error-red border-t border-r border-b";
          } else if (inc.status !== 'Resolved') {
            if (isBreached) {
              cardBgClass = "bg-error-red/5 border-error-red/20";
              borderHighlightClass = "border-l-4 border-l-error-red border-t border-r border-b";
            } else {
              cardBgClass = "bg-warning-orange/5 border-warning-orange/20";
              borderHighlightClass = "border-l-4 border-l-warning-orange border-t border-r border-b";
            }
          }
          
          return (
            <div key={inc.id} className={`${cardBgClass} ${borderHighlightClass} rounded-xl p-5 flex flex-col gap-4 relative group hover:bg-glass-fill/85 transition-all duration-300`}>
              <div className="flex justify-between items-center">
                <div className="font-bold text-white flex items-center gap-2">
                  {inc.type === 'SOS' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-error-red inline-block animate-pulse shadow-[0_0_8px_rgba(229,57,53,0.8)]"></span>
                  )}
                  {inc.type} Alert
                </div>
                <div className={`text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider ${
                  inc.status === 'Resolved' ? 'bg-primary/20 text-primary border border-primary/30' :
                  inc.status === 'Escalated' ? 'bg-error-red/20 text-error-red border border-error-red/30' :
                  'bg-warning-orange/20 text-warning-orange border border-warning-orange/30'
                }`}>
                  {inc.status}
                </div>
              </div>

              <div className="text-sm text-on-surface-variant leading-relaxed">
                <strong>Reported By:</strong> {inc.reporter_name} ({inc.reporter_role}) <br/>
                {inc.reporter_role === 'Pool Host' && <span><strong>Vehicle:</strong> {inc.vehicle_no} <br/></span>}
                <span className="text-xs text-on-surface-variant/75 mt-2 block">Triggered At: {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {inc.status === 'Open' && (
                <div className={`text-center py-2 px-4 rounded-lg font-bold text-sm bg-surface-base/50 ${
                  isBreached ? 'text-error-red border border-error-red/20' : 'text-warning-orange border border-warning-orange/20'
                }`}>
                  {isBreached ? 'SLA BREACHED' : `SLA: ${minsLeft} mins left`}
                </div>
              )}

              {inc.status === 'Escalated' && (
                <div className="text-center py-2 px-4 rounded-lg font-bold text-sm bg-error-red/10 text-error-red border border-dashed border-error-red/30 uppercase tracking-wide">
                  ERT DISPATCHED & ACTIVE
                </div>
              )}

              {inc.status === 'Open' && (
                <div className="flex gap-3 mt-2">
                  <button className="flex-1 py-2 rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-surface-deep border border-primary/30 font-bold text-xs transition-all duration-300" onClick={() => handleResolve(inc.id)}>Resolve</button>
                  <button className="flex-1 py-2 rounded-lg border border-error-red/30 text-error-red hover:bg-error-red/10 font-bold text-xs transition-colors" onClick={() => handleEscalate(inc.id)}>Escalate ERT</button>
                </div>
              )}

              {inc.status === 'Escalated' && (
                <button className="mt-2 w-full py-2.5 rounded-lg bg-primary/25 hover:bg-primary text-primary hover:text-surface-deep border border-primary/30 font-bold text-xs transition-all duration-300" onClick={() => handleResolve(inc.id)}>Mark Resolved</button>
              )}
            </div>
          );
        })}
        {incidents.length === 0 && (
          <div className="col-span-full text-on-surface-variant italic text-center py-10">
            No active incidents in queue.
          </div>
        )}
      </div>
    </div>
  );
};
export default IncidentQueue;
