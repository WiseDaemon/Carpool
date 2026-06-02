import React, { useState, useEffect } from 'react';

const TripsDashboard = ({ showToast, session }) => {
  const [trips, setTrips] = useState([]);
  const [loadingTripId, setLoadingTripId] = useState(null);

  useEffect(() => {
    fetch(`/api/trips`, {
      headers: { 'Authorization': `Bearer ${session?.token}` }
    })
      .then(res => res.json())
      .then(data => setTrips(data))
      .catch(console.error);
  }, [session]);

  const handleReportIssue = async (tripId) => {
    if (!window.confirm('Are you sure you want to flag this trip for manual review?')) return;
    
    setLoadingTripId(tripId);
    try {
      const res = await fetch(`/api/incidents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          reported_by: session?.id || 1,
          type: `Manual Trip Review: Trip #${tripId}`
        })
      });
      
      if (res.ok) {
        if (showToast) showToast(`Trip #${tripId} has been flagged for review. Support has been notified.`, 'warning');
      } else {
        if (showToast) showToast(`Failed to report issue for Trip #${tripId}.`, 'danger');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error while reporting trip issue.', 'danger');
    } finally {
      setLoadingTripId(null);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl animate-slide-in">
      <h2 className="text-xl font-bold text-white border-b border-white/10 pb-4 mb-6">Trips & Safety Issues</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {trips.map(trip => (
          <div key={trip.id} className="bg-surface-container/30 border border-white/5 rounded-xl p-5 flex flex-col gap-4 hover:bg-surface-bright/20 transition-all duration-300 relative group">
            <div className="flex justify-between items-center">
              <div className="font-bold text-white group-hover:text-primary transition-colors">Trip #{trip.id}</div>
              <div className="text-xs px-2.5 py-1 rounded bg-primary/20 text-primary border border-primary/30 font-semibold uppercase tracking-wider">
                {trip.status}
              </div>
            </div>

            <div className="text-sm text-on-surface-variant leading-relaxed">
              <strong>Pool Host:</strong> {trip.driver_name} <br/>
              <strong>Vehicle:</strong> <span className="uppercase">{trip.vehicle_no}</span>
            </div>

            <div className="bg-surface-base/50 p-4 rounded-lg text-sm border border-white/5 relative">
              <div className="absolute left-[20px] top-[28px] bottom-[28px] w-[2px] bg-gradient-to-b from-primary to-accent-blue opacity-35"></div>
              
              <div className="flex items-start gap-3 mb-3 relative z-10">
                <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-surface-deep font-bold mt-0.5">●</span>
                <div>
                  <div className="text-xs font-semibold text-primary uppercase">Origin</div>
                  <div className="text-white text-xs mt-0.5">{trip.origin}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 relative z-10">
                <span className="w-4 h-4 rounded-full bg-accent-blue flex items-center justify-center text-[8px] text-surface-deep font-bold mt-0.5">■</span>
                <div>
                  <div className="text-xs font-semibold text-accent-blue uppercase">Destination</div>
                  <div className="text-white text-xs mt-0.5">{trip.destination}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-xs text-on-surface-variant border-t border-white/5 pt-3">
              <span>Departs: <strong className="text-white">{trip.departure_time}</strong></span>
              <span>Seats: <strong className="text-white">{trip.seats_offered}</strong></span>
            </div>

            <button 
              className="mt-2 w-full py-2.5 rounded-lg border border-warning-orange/30 text-warning-orange hover:bg-warning-orange/10 font-bold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2" 
              onClick={() => handleReportIssue(trip.id)}
              disabled={loadingTripId === trip.id}
            >
              {loadingTripId === trip.id ? (
                <><span className="material-symbols-outlined animate-spin text-[16px]">sync</span> Reporting...</>
              ) : (
                'Report Trip Issue'
              )}
            </button>
          </div>
        ))}
        {trips.length === 0 && (
          <div className="col-span-full text-on-surface-variant italic text-center py-10">
            No active or past trips found.
          </div>
        )}
      </div>
    </div>
  );
};
export default TripsDashboard;
