import React, { useState, useEffect, useRef } from 'react';
import MapComponent, { AutocompleteInput } from './MapComponent';
import AIChat from './AIChat';
import ChatModal from './ChatModal';
import AppLayout from './AppLayout';
import Settings from './Settings';
import SwipeToComplete from './SwipeToComplete';

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const PoolHostDashboard = ({ user, onLogout, showToast, onUpdateUser, socket }) => {
  const watchIdRef = useRef(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState({
    rides_offered: 0,
    people_carpooled: 0,
    pending_requests: 0,
    avg_earning: 0,
    co2_saved: 0
  });

  const [origin, setOrigin] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [departureTime, setDepartureTime] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState(50);
  const [seatsOffered, setSeatsOffered] = useState(3);
  const [womenOnly, setWomenOnly] = useState(false);
  const [recurringDays, setRecurringDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const toggleDay = (d) => setRecurringDays(prev => prev.includes(d) ? prev.filter(day => day !== d) : [...prev, d]);
  
  const [listedRides, setListedRides] = useState([]);
  const [historyTab, setHistoryTab] = useState('Active');
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosType, setSosType] = useState('Safety Concern');
  const [notifications, setNotifications] = useState([]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editVehicleNo, setEditVehicleNo] = useState(user.vehicle_no || '');
  const [editVehicleMake, setEditVehicleMake] = useState(user.vehicle_make || '');
  const [editVehicleModel, setEditVehicleModel] = useState(user.vehicle_model || '');
  const [editVehicleCapacity, setEditVehicleCapacity] = useState(user.vehicle_capacity || '4+1');
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeChat, setActiveChat] = useState({ isOpen: false, requestId: null, passengerName: '' });
  const [mapMode, setMapMode] = useState('pickup');

  const handleLocationSelect = async (lat, lng) => {
    try {
      const response = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
      const data = await response.json();
      const place = data.features && data.features[0];
      const name = place ? (place.properties.name || place.properties.street || place.properties.city || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`) : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      
      if (mapMode === 'pickup') {
        setPickupCoords({ lat, lng, name });
        setOrigin(name);
      } else {
        setDropoffCoords({ lat, lng, name });
        setDestination(name);
      }
    } catch (error) {
      const defaultName = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      if (mapMode === 'pickup') {
        setPickupCoords({ lat, lng, name: defaultName });
        setOrigin(defaultName);
      } else {
        setDropoffCoords({ lat, lng, name: defaultName });
        setDestination(defaultName);
      }
    }
  };

  const fetchStatsAndRides = async () => {
    try {
      const statsRes = await fetch(`/api/users/${user.id}/stats`);
      if (statsRes.ok) setStats(await statsRes.json());
      const ridesRes = await fetch(`/api/users/${user.id}/rides`);
      if (ridesRes.ok) setListedRides(await ridesRes.json());
      const notifRes = await fetch(`/api/users/${user.id}/notifications`);
      if (notifRes.ok) setNotifications(await notifRes.json());
    } catch (e) {
      console.error('Error fetching driver dashboard data:', e);
    }
  };

  const [etaMins, setEtaMins] = useState(null);

  useEffect(() => {
    fetchStatsAndRides();
    if (socket) {
      socket.on('eta_update', (data) => setEtaMins(data.eta_mins));
      socket.on('eta_alert', (data) => showToast(data.message, 'danger'));
      socket.on('ride_completed', () => {
        showToast('Ride completed successfully.', 'success');
        fetchStatsAndRides();
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      });
      socket.on('route_updated', (data) => {
        setListedRides(prev => prev.map(r =>
          r.id === data.ride_id
            ? { ...r, route_polyline: data.route_polyline, expected_duration_mins: data.duration_mins }
            : r
        ));
        showToast('Route optimised for new passenger.', 'info');
      });
    }
    return () => {
      if (socket) {
        socket.off('eta_update');
        socket.off('eta_alert');
        socket.off('ride_completed');
        socket.off('route_updated');
      }
    };
  }, [user.id, socket]);

  const getMaxSeats = () => {
    if (!user.vehicle_capacity) return 4;
    const match = user.vehicle_capacity.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 4;
  };
  const maxSeats = getMaxSeats();
  
  const allPendingRequests = listedRides
    .filter(ride => ride.status === 'Scheduled')
    .flatMap(ride => (ride.requests || []).map(req => ({ ...req, ride_id: ride.id, ride_origin: ride.origin, ride_destination: ride.destination })))
    .filter(req => req.request_status === 'Pending');

  const nextScheduledRide = listedRides.find(ride => ride.status === 'Scheduled');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return showToast('Name cannot be empty.', 'warning');
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(), vehicle_no: editVehicleNo.trim(),
          vehicle_make: editVehicleMake.trim(), vehicle_model: editVehicleModel.trim(),
          vehicle_capacity: editVehicleCapacity
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profile updated successfully!', 'success');
        onUpdateUser(data.user);
        setShowProfileModal(false);
      } else showToast(data.error || 'Failed to update profile.', 'danger');
    } catch (err) {
      showToast('Network error updating profile.', 'danger');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOfferRide = async (e) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords || !departureTime) {
      return showToast('Please select coordinates for both Origin and Destination, and specify departure time.', 'warning');
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rides/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: user.id,
          origin, destination,
          origin_lat: pickupCoords.lat, origin_lng: pickupCoords.lng,
          dest_lat: dropoffCoords.lat, dest_lng: dropoffCoords.lng,
          departure_time: departureTime,
          recurring_days: recurringDays.join(','),
          seats_offered: seatsOffered,
          price_per_seat: pricePerSeat,
          women_only: womenOnly
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Commute successfully created! You can now find passengers.', 'success');
        setCurrentView('dashboard');
        fetchStatsAndRides();
        setOrigin(''); setDestination(''); setPickupCoords(null); setDropoffCoords(null); setDepartureTime('');
      } else {
        showToast(data.error || 'Failed to create commute.', 'danger');
      }
    } catch (err) {
      showToast('Network error while creating commute.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const [passengerMatches, setPassengerMatches] = useState([]);
  const [searchPassengersLoading, setSearchPassengersLoading] = useState(false);

  const handleSearchPassengers = async () => {
    setSearchPassengersLoading(true);
    try {
      const res = await fetch(`/api/passenger-listings/match/${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setPassengerMatches(data.matches || []);
        if (data.matches.length === 0) showToast('No matching passenger requests found near your route.', 'warning');
      } else {
        showToast(data.error || 'Failed to search passengers.', 'danger');
      }
    } catch (err) {
      showToast('Network error while searching passengers.', 'danger');
    } finally {
      setSearchPassengersLoading(false);
    }
  };

  const handleOfferRideToPassenger = async (passengerListing) => {
    setActionLoading(passengerListing.id);
    try {
      const res = await fetch(`/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ride_id: passengerListing.ride_id, 
          passenger_id: passengerListing.passenger_id, 
          passenger_listing_id: passengerListing.id,
          request_type: 'HostOffer'
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Offer successfully sent to ${passengerListing.passenger_name}!`, 'success');
        setPassengerMatches(prev => prev.filter(m => m.id !== passengerListing.id));
        fetchStatsAndRides();
      } else {
        showToast(data.error || 'Failed to send offer.', 'danger');
      }
    } catch (err) {
      showToast('Network error.', 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (requestId, passengerName) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/rides/request/${requestId}/accept`, { method: 'POST' });
      if (res.ok) { showToast(`Accepted ride request from ${passengerName}!`, 'success'); fetchStatsAndRides(); }
    } catch (err) { showToast('Network error accepting request.', 'danger'); } finally { setActionLoading(null); }
  };

  const handleRejectRequest = async (requestId, passengerName) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/rides/request/${requestId}/reject`, { method: 'POST' });
      if (res.ok) { showToast(`Rejected ride request from ${passengerName}.`, 'info'); fetchStatsAndRides(); }
    } catch (err) { showToast('Network error rejecting request.', 'danger'); } finally { setActionLoading(null); }
  };

  const handleNoShow = async (requestId, passengerName) => {
    if (!window.confirm(`Mark ${passengerName} as a No-Show? They will be penalized.`)) return;
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/rides/request/${requestId}/no-show`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_by_role: 'Host' })
      });
      if (res.ok) { showToast(`Reported ${passengerName} as a No-Show.`, 'success'); fetchStatsAndRides(); }
      else { const data = await res.json(); showToast(data.error || 'Failed to report no-show.', 'danger'); }
    } catch (err) { showToast('Network error.', 'danger'); } finally { setActionLoading(null); }
  };

  const handleCancelRide = async (rideId) => {
    if (!window.confirm('Cancel this scheduled ride and notify passengers?')) return;
    setActionLoading(`ride-${rideId}`);
    try {
      const res = await fetch(`/api/rides/${rideId}/cancel`, { method: 'POST' });
      if (res.ok) { 
        showToast('Ride cancelled.', 'info'); 
        fetchStatsAndRides(); 
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      }
    } catch (err) { showToast('Network error.', 'danger'); } finally { setActionLoading(null); }
  };

  const handleCompleteRide = async (rideId) => {
    if (!window.confirm('Mark this ride as completed?')) return;
    setActionLoading(`ride-${rideId}`);
    try {
      const res = await fetch(`/api/rides/${rideId}/complete`, { method: 'POST' });
      if (res.ok) { 
        showToast('Ride marked as completed.', 'success'); 
        fetchStatsAndRides(); 
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      }
    } catch (err) { showToast('Network error.', 'danger'); } finally { setActionLoading(null); }
  };

  const handleNotifyPassengers = async (rideId) => {
    setActionLoading(`ride-${rideId}`);
    try {
      const res = await fetch(`/api/rides/${rideId}/notify`, { method: 'POST' });
      let data = {};
      try { data = await res.json(); } catch(e) { console.error('Non-JSON response from server'); }
      if (res.ok) {
        showToast('Passengers have been notified that you are arriving soon!', 'success');
      } else {
        showToast(data.error || 'Failed to notify passengers. Ensure server is running.', 'warning');
      }
    } catch (err) { showToast('Network error.', 'danger'); } finally { setActionLoading(null); }
  };

  const handleStartRide = async (rideId) => {
    setActionLoading(`ride-${rideId}`);
    try {
      const res = await fetch(`/api/rides/${rideId}/start`, { method: 'POST' });
      let data = {};
      try { data = await res.json(); } catch(e) { console.error('Non-JSON response from server'); }
      if (res.ok) {
        showToast('Ride started! Live tracking enabled.', 'success');
        fetchStatsAndRides();
        
        // Start GPS tracking
        if (navigator.geolocation) {
          if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              fetch(`/api/rides/${rideId}/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
              }).catch(() => {}); // silent fail
            },
            (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
          );
        }
      } else {
        showToast(data.error || 'Failed to start ride.', 'warning');
      }
    } catch (err) { showToast('Network error.', 'danger'); } finally { setActionLoading(null); }
  };

  const triggerSos = async () => {
    try {
      const res = await fetch(`/api/incidents/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_by: user.id, type: `SOS: ${sosType}` })
      });
      if (res.ok) {
        showToast('CRITICAL: SOS alarm transmitted.', 'danger');
        setShowSosModal(false);
      }
    } catch (err) { showToast('Network error dispatching SOS.', 'danger'); }
  };

  const navItems = [
    { id: 'new', label: 'List Commute', icon: 'directions_car', isPrimaryAction: true, onClick: () => setCurrentView('new_commute') },
    { id: 'dashboard', label: 'Host Dashboard', icon: 'dashboard', onClick: () => setCurrentView('dashboard') },
    { id: 'new_commute', label: 'Offer a Ride', icon: 'add_location', onClick: () => setCurrentView('new_commute') },
    { id: 'past_rides', label: 'Past Rides', icon: 'history', onClick: () => setCurrentView('past_rides') }
  ];

  return (
    <AppLayout 
      user={user} 
      onLogout={onLogout} 
      onSettingsClick={() => setCurrentView('settings')} 
      notifications={notifications} 
      onSosClick={() => setShowSosModal(true)} 
      navItems={navItems} 
      activeNavId={currentView}
    >
      <div className="pt-6 h-full max-w-[1440px] mx-auto">
        {currentView === 'dashboard' ? (
          <>
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 mt-2">
              <div>
                <h2 className="font-headline-xl text-headline-xl lg:text-headline-xl font-bold text-on-surface tracking-tight">Host Dashboard</h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Manage your listings, incoming requests, and vehicle status.</p>
              </div>
              <div className="flex gap-4 self-start sm:self-auto">
                <button 
                  onClick={handleSearchPassengers}
                  disabled={searchPassengersLoading}
                  className="bg-secondary text-background font-label-lg text-label-lg rounded-full py-3 px-6 flex items-center justify-center gap-2 transition-all duration-300 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined">person_search</span>
                  {searchPassengersLoading ? 'Searching...' : 'Find Passengers'}
                </button>
                <button 
                  onClick={() => setCurrentView('new_commute')}
                  className="bg-primary text-on-primary font-label-lg text-label-lg rounded-full py-3 px-6 flex items-center justify-center gap-2 neon-glow-primary hover:scale-[1.02] neon-glow-primary-hover transition-all duration-300 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined">add</span>
                  List New Commute
                </button>
              </div>
            </header>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop">
              {/* Left Column (Spans 8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-gutter-desktop">
                {/* Vehicle Verification Banner */}
                <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
                      <span className="material-symbols-outlined icon-fill text-2xl">verified</span>
                    </div>
                    <div>
                      <h3 className="font-headline-md text-headline-md text-on-surface">
                        {user.vehicle_make || 'No Vehicle'} {user.vehicle_model || ''}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-1">
                        {user.has_vehicle_pass ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-tertiary inline-block shadow-[0_0_8px_rgba(140,218,109,0.5)]"></span>
                            Vehicle Verified &amp; Active
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-warning-orange inline-block shadow-[0_0_8px_rgba(251,140,0,0.5)]"></span>
                            Pending Document Verification
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowProfileModal(true)} className="text-primary font-label-lg text-label-lg hover:underline decoration-primary underline-offset-4 transition-all">Manage Vehicle</button>
                </div>

                {/* Incoming Requests Section */}
                <section className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-lg flex flex-col h-full">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">group_add</span>
                      Pending Requests
                      {allPendingRequests.length > 0 && (
                        <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full font-label-sm text-label-sm ml-2">
                          {allPendingRequests.length}
                        </span>
                      )}
                    </h3>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Incoming carpool requests</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {allPendingRequests.map(req => (
                      <div key={req.request_id} className="bg-surface-container-high/50 border border-white/5 rounded-lg p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:bg-surface-container-high transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full border-2 border-surface-variant bg-surface-bright flex items-center justify-center font-bold text-xl text-primary overflow-hidden shrink-0">
                            {req.passenger_name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-label-lg text-label-lg text-on-surface">{req.passenger_name}</h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              {req.passenger_email} • {req.ride_origin} → {req.ride_destination}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="bg-tertiary/10 text-tertiary px-2 py-1 rounded border border-tertiary/20 font-label-md text-label-md flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">route</span>
                                Route Match Checked
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                          <button 
                            disabled={actionLoading === req.request_id}
                            onClick={() => handleRejectRequest(req.request_id, req.passenger_name)}
                            className="flex-1 sm:flex-none border border-outline-variant text-on-surface-variant hover:bg-surface-bright/30 font-label-lg text-label-lg px-4 py-2 rounded-lg transition-all duration-200"
                          >
                            Reject
                          </button>
                          <button 
                            disabled={actionLoading === req.request_id}
                            onClick={() => handleAcceptRequest(req.request_id, req.passenger_name)}
                            className="flex-1 sm:flex-none bg-primary text-on-primary hover:scale-[1.02] neon-glow-primary font-label-lg text-label-lg px-4 py-2 rounded-lg transition-all duration-200"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                    {allPendingRequests.length === 0 && (
                      <div className="text-on-surface-variant italic p-8 text-center bg-surface-container/20 rounded-lg">
                        No pending requests for tomorrow's commutes.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column (Spans 4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-gutter-desktop">
                {/* Next Scheduled Drive Card */}
                <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-8xl text-primary">directions_car</span>
                  </div>
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <h3 className="font-headline-md text-headline-md text-on-surface">
                        {nextScheduledRide?.status === 'In Progress' ? 'Current Drive' : 'Next Scheduled Drive'}
                      </h3>
                      {etaMins !== null && nextScheduledRide?.status === 'In Progress' && (
                        <span className="bg-tertiary/20 text-tertiary border border-tertiary/30 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                          ETA: {etaMins} mins
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {nextScheduledRide ? (
                    <div className="relative z-10 flex flex-col gap-5">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center mt-1">
                          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(103,218,182,0.8)]"></div>
                          <div className="w-0.5 h-10 route-line opacity-50 my-1"></div>
                          <div className="w-3 h-3 rounded-full border-2 border-secondary bg-surface-deep"></div>
                        </div>
                        <div className="flex flex-col gap-4 overflow-hidden">
                          <div>
                            <p className="font-label-lg text-label-lg text-on-surface truncate" title={nextScheduledRide.origin}>{nextScheduledRide.origin}</p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">Departs: {nextScheduledRide.departure_time}</p>
                          </div>
                          <div>
                            <p className="font-label-lg text-label-lg text-on-surface truncate" title={nextScheduledRide.destination}>{nextScheduledRide.destination}</p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">Destination</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-surface-container/50 rounded-lg p-4 mt-2 border border-white/5">
                        <p className="font-label-md text-label-md text-on-surface-variant mb-2">
                          Confirmed Passengers ({nextScheduledRide.requests ? nextScheduledRide.requests.filter(r => r.request_status === 'Accepted').length : 0}/{nextScheduledRide.seats_offered + (nextScheduledRide.requests ? nextScheduledRide.requests.filter(r => r.request_status === 'Accepted').length : 0)})
                        </p>
                        <div className="flex flex-col gap-2">
                          {nextScheduledRide.requests && nextScheduledRide.requests.filter(r => r.request_status === 'Accepted').map(req => (
                            <div key={req.request_id} className="flex items-center justify-between bg-surface-base/40 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                  {req.passenger_avatar_url ? (
                                    <img src={req.passenger_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                  ) : (
                                    req.passenger_name.charAt(0)
                                  )}
                                </div>
                                <span className="text-sm text-on-surface">{req.passenger_name}</span>
                              </div>
                              <button
                                onClick={() => setActiveChat({ isOpen: true, requestId: req.request_id, passengerName: req.passenger_name })}
                                className="flex items-center gap-1 text-primary hover:text-white border border-primary/30 hover:bg-primary/20 px-2 py-1 rounded text-xs transition-colors"
                                title={`Chat with ${req.passenger_name}`}
                              >
                                <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                Chat
                              </button>
                            </div>
                          ))}
                          {(!nextScheduledRide.requests || nextScheduledRide.requests.filter(r => r.request_status === 'Accepted').length === 0) && (
                            <span className="text-xs text-on-surface-variant italic">No confirmed passengers yet</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        {nextScheduledRide.status === 'Scheduled' && (
                          <>
                            <button 
                              onClick={() => handleNotifyPassengers(nextScheduledRide.id)}
                              disabled={actionLoading === `ride-${nextScheduledRide.id}`}
                              className="flex-1 bg-accent-blue/20 text-accent-blue border border-accent-blue/30 font-label-sm text-label-sm py-2 rounded-lg hover:bg-accent-blue/30 transition-all"
                            >
                              Notify
                            </button>
                            <button 
                              onClick={() => handleStartRide(nextScheduledRide.id)}
                              disabled={actionLoading === `ride-${nextScheduledRide.id}`}
                              className="flex-1 bg-secondary text-on-primary font-label-sm text-label-sm py-2 rounded-lg hover:scale-[1.02] transition-all"
                            >
                              Start
                            </button>
                          </>
                        )}
                        {nextScheduledRide.status === 'In Progress' ? (
                          <div className="flex-1">
                            <SwipeToComplete 
                              onComplete={() => handleCompleteRide(nextScheduledRide.id)}
                              disabled={getDistanceFromLatLonInKm(currentLocation?.lat, currentLocation?.lng, nextScheduledRide.dest_lat, nextScheduledRide.dest_lng) > 0.25 || actionLoading === `ride-${nextScheduledRide.id}`}
                              label={getDistanceFromLatLonInKm(currentLocation?.lat, currentLocation?.lng, nextScheduledRide.dest_lat, nextScheduledRide.dest_lng) > 0.25 ? 'Too far to complete' : 'Slide to Complete'}
                            />
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleCompleteRide(nextScheduledRide.id)}
                            disabled={actionLoading === `ride-${nextScheduledRide.id}`}
                            className="flex-1 bg-primary text-on-primary font-label-sm text-label-sm py-2 rounded-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                          >
                            Complete
                          </button>
                        )}
                        <button 
                          onClick={() => handleCancelRide(nextScheduledRide.id)}
                          disabled={actionLoading === `ride-${nextScheduledRide.id}`}
                          className="flex-1 border border-error-red/30 text-error-red hover:bg-error-red/10 font-label-sm text-label-sm py-2 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-on-surface-variant italic p-4 text-center bg-surface-container/20 rounded-lg">
                      No upcoming scheduled drives.
                    </div>
                  )}
                </div>

                {/* Host Stats (Extended Bento) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-lg flex items-center gap-4 group hover:bg-surface-bright/10 transition-all duration-300">
                    <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-primary">payments</span>
                    </div>
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant">Total Earnings</p>
                      <h4 className="font-headline-lg text-headline-lg text-on-surface font-bold">₹{((stats.rides_offered || 0) * (stats.avg_earning || 0)).toFixed(0)}</h4>
                    </div>
                  </div>
                  <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-lg flex flex-col justify-center items-center text-center group hover:bg-surface-bright/10 transition-all duration-300">
                    <span className="material-symbols-outlined text-secondary mb-2 text-3xl group-hover:scale-110 transition-transform">eco</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface font-bold">{stats.co2_saved || 0}</h4>
                    <p className="font-label-md text-label-md text-on-surface-variant mt-1">CO₂ Saved (kg)</p>
                  </div>
                  <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-lg flex flex-col justify-center items-center text-center group hover:bg-surface-bright/10 transition-all duration-300">
                    <span className="material-symbols-outlined text-tertiary mb-2 text-3xl group-hover:scale-110 transition-transform">star</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface font-bold">4.9</h4>
                    <p className="font-label-md text-label-md text-on-surface-variant mt-1">Host Rating</p>
                  </div>
                  <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-lg flex flex-col justify-center items-center text-center group hover:bg-surface-bright/10 transition-all duration-300">
                    <span className="material-symbols-outlined text-accent-blue mb-2 text-3xl group-hover:scale-110 transition-transform">groups</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface font-bold">{stats.people_carpooled || 0}</h4>
                    <p className="font-label-md text-label-md text-on-surface-variant mt-1">Passengers Served</p>
                  </div>
                  <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-lg flex flex-col justify-center items-center text-center group hover:bg-surface-bright/10 transition-all duration-300">
                    <span className="material-symbols-outlined text-warning-orange mb-2 text-3xl group-hover:scale-110 transition-transform">schedule</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface font-bold">96%</h4>
                    <p className="font-label-md text-label-md text-on-surface-variant mt-1">On-Time Rate</p>
                  </div>
                  <div className="bg-glass-fill backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-lg flex flex-col justify-center items-center text-center group hover:bg-surface-bright/10 transition-all duration-300">
                    <span className="material-symbols-outlined text-accent-teal mb-2 text-3xl group-hover:scale-110 transition-transform">airline_seat_recline_extra</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface font-bold">{stats.rides_offered || 0}</h4>
                    <p className="font-label-md text-label-md text-on-surface-variant mt-1">Rides Offered</p>
                  </div>
                </div>
              </div>
            </div>

            {/* All My Rides List */}
            <section className="mt-8 glass-panel rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">list_alt</span>
                  Active Offered Rides
                  <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full font-label-sm text-label-sm ml-2">{listedRides.filter(r => r.status === 'Scheduled' || r.status === 'In Progress').length}</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-on-surface-variant text-sm">
                      <th className="pb-3 font-medium">Route</th>
                      <th className="pb-3 font-medium">Departure</th>
                      <th className="pb-3 font-medium">Seats</th>
                      <th className="pb-3 font-medium">Price/Seat</th>
                      <th className="pb-3 font-medium">Passengers</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listedRides
                      .filter(ride => (ride.status === 'Scheduled' || ride.status === 'In Progress'))
                      .map(ride => {
                        const acceptedPassengers = (ride.requests || []).filter(r => r.request_status === 'Accepted');
                        return (
                          <tr key={ride.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-4 font-bold text-white">
                              <p className="truncate max-w-[180px]" title={ride.origin}>{ride.origin}</p>
                              <p className="text-xs text-on-surface-variant truncate max-w-[180px]" title={ride.destination}>→ {ride.destination}</p>
                            </td>
                            <td className="py-4 text-on-surface">{ride.departure_time}</td>
                            <td className="py-4 text-on-surface">{ride.seats_offered} left</td>
                            <td className="py-4 text-on-surface">₹{ride.price_per_seat}</td>
                            <td className="py-4">
                              <div className="flex flex-col gap-1">
                                {acceptedPassengers.length === 0 ? (
                                  <span className="text-xs text-on-surface-variant italic">None yet</span>
                                ) : (
                                  acceptedPassengers.map(req => (
                                    <div key={req.request_id} className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                                        {req.passenger_avatar_url ? (
                                          <img src={req.passenger_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                          req.passenger_name.charAt(0)
                                        )}
                                      </div>
                                      <span className="text-xs text-on-surface">{req.passenger_name}</span>
                                      {(ride.status === 'Scheduled' || ride.status === 'In Progress') && (
                                        <>
                                          <button
                                            onClick={() => setActiveChat({ isOpen: true, requestId: req.request_id, passengerName: req.passenger_name })}
                                            className="text-primary hover:text-white transition-colors"
                                            title={`Chat with ${req.passenger_name}`}
                                          >
                                            <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                          </button>
                                          <button
                                            onClick={() => handleNoShow(req.request_id, req.passenger_name)}
                                            className="text-error-red hover:text-white transition-colors ml-1"
                                            title={`Mark ${req.passenger_name} as No-Show`}
                                          >
                                            <span className="material-symbols-outlined text-[14px]">person_off</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                ride.status === 'Scheduled' ? 'bg-primary/20 text-primary border border-primary/30' :
                                ride.status === 'In Progress' ? 'bg-secondary/20 text-secondary border border-secondary/30' :
                                ride.status === 'Completed' ? 'bg-surface-container text-on-surface-variant border border-white/10' :
                                'bg-error-red/20 text-error-red border border-error-red/30'
                              }`}>{ride.status}</span>
                            </td>
                            <td className="py-4">
                              {(ride.status === 'Scheduled' || ride.status === 'In Progress') && (
                                <div className="flex flex-wrap gap-2">
                                  {ride.status === 'Scheduled' && (
                                    <>
                                      <button
                                        disabled={actionLoading === `ride-${ride.id}`}
                                        onClick={() => handleNotifyPassengers(ride.id)}
                                        className="text-[10px] px-2 py-1 bg-accent-blue/20 text-accent-blue border border-accent-blue/30 rounded hover:bg-accent-blue/30 transition-colors"
                                      >Notify</button>
                                      <button
                                        disabled={actionLoading === `ride-${ride.id}`}
                                        onClick={() => handleStartRide(ride.id)}
                                        className="text-[10px] px-2 py-1 bg-secondary/20 text-secondary border border-secondary/30 rounded hover:bg-secondary/30 transition-colors"
                                      >Start</button>
                                    </>
                                  )}
                                  <button
                                    disabled={actionLoading === `ride-${ride.id}`}
                                    onClick={() => handleCompleteRide(ride.id)}
                                    className="text-[10px] px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/40 transition-colors"
                                  >Complete</button>
                                  <button
                                    disabled={actionLoading === `ride-${ride.id}`}
                                    onClick={() => handleCancelRide(ride.id)}
                                    className="text-[10px] px-2 py-1 bg-error-red/10 text-error-red border border-error-red/30 rounded hover:bg-error-red/20 transition-colors"
                                  >Cancel</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    }
                    {listedRides.filter(ride => (ride.status === 'Scheduled' || ride.status === 'In Progress')).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-on-surface-variant italic">
                          No active rides. List a commute to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {passengerMatches.length > 0 && (
              <section className="mt-8 glass-panel rounded-xl p-6 shadow-lg border border-secondary/30 bg-secondary/5">
                <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-secondary">group_add</span>
                  Matching Passengers Need a Ride
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {passengerMatches.map((m, idx) => (
                    <div key={idx} className="bg-surface-container rounded-xl p-5 border border-white/5 flex flex-col hover:bg-surface-bright/20 transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary font-bold flex items-center justify-center border border-secondary/30 text-sm overflow-hidden">
                            {m.passenger_avatar_url ? (
                              <img src={m.passenger_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              m.passenger_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-label-md text-label-md text-on-surface">{m.passenger_name}</p>
                            <p className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">schedule</span> {m.departure_time}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 mb-6 space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></span>
                          <p className="text-xs text-on-surface-variant line-clamp-2" title={m.origin}>{m.origin}</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-secondary text-[10px] mt-1 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                          <p className="text-xs text-on-surface-variant line-clamp-2" title={m.destination}>{m.destination}</p>
                        </div>
                        <div className="mt-2 text-xs text-on-surface-variant bg-surface px-2 py-1 rounded inline-block">
                          <span className="font-bold text-on-surface">Recurring:</span> {m.recurring_days}
                        </div>
                      </div>
                      <button onClick={() => handleOfferRideToPassenger(m)} disabled={actionLoading === m.id} className="w-full btn-secondary py-2 rounded-lg font-bold flex items-center justify-center gap-2 border border-secondary/30 text-secondary hover:bg-secondary/10">
                        <span className="material-symbols-outlined text-sm">handshake</span>
                        {actionLoading === m.id ? 'Sending...' : 'Offer Ride'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : currentView === 'past_rides' ? (
          <div className="mt-8 glass-panel rounded-xl p-8">
            <h3 className="text-xl text-white font-bold mb-6">Past Offered Rides</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-on-surface-variant text-sm">
                    <th className="pb-3 font-medium">Route</th>
                    <th className="pb-3 font-medium">Departure</th>
                    <th className="pb-3 font-medium">Seats</th>
                    <th className="pb-3 font-medium">Price/Seat</th>
                    <th className="pb-3 font-medium">Passengers</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listedRides
                    .filter(ride => (ride.status !== 'Scheduled' && ride.status !== 'In Progress'))
                    .map(ride => {
                      const acceptedPassengers = (ride.requests || []).filter(r => r.request_status === 'Accepted');
                      return (
                        <tr key={ride.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-4 font-bold text-white">
                            <p className="truncate max-w-[180px]" title={ride.origin}>{ride.origin}</p>
                            <p className="text-xs text-on-surface-variant truncate max-w-[180px]" title={ride.destination}>→ {ride.destination}</p>
                          </td>
                          <td className="py-4 text-on-surface">{ride.departure_time}</td>
                          <td className="py-4 text-on-surface">{ride.seats_offered} left</td>
                          <td className="py-4 text-on-surface">₹{ride.price_per_seat}</td>
                          <td className="py-4">
                            <div className="flex flex-col gap-1">
                              {acceptedPassengers.length === 0 ? (
                                <span className="text-xs text-on-surface-variant italic">None</span>
                              ) : (
                                acceptedPassengers.map(req => (
                                  <div key={req.request_id} className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-[10px] shrink-0">
                                      {req.passenger_name.charAt(0)}
                                    </div>
                                    <span className="text-xs text-on-surface">{req.passenger_name}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              ride.status === 'Completed' ? 'bg-surface-container text-on-surface-variant border border-white/10' :
                              'bg-error-red/20 text-error-red border border-error-red/30'
                            }`}>{ride.status}</span>
                          </td>
                        </tr>
                      );
                    })
                  }
                  {listedRides.filter(ride => (ride.status !== 'Scheduled' && ride.status !== 'In Progress')).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant italic">
                        No past rides yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : currentView === 'settings' ? (
          <Settings user={user} showToast={showToast} onUpdateUser={onUpdateUser} />
        ) : (
          <>
            <header className="mb-8">
              <h1 className="text-3xl text-white font-bold mb-2">Offer a Commute</h1>
              <p className="text-on-surface-variant">List your ride to carpool with colleagues.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <section className="lg:col-span-6 glass-panel rounded-xl p-8 shadow-lg flex flex-col justify-between">
                <form onSubmit={handleOfferRide} className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2 relative z-20">
                      <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Origin</label>
                      <AutocompleteInput placeholder="Start location" value={origin} onChange={setOrigin} onSelect={setPickupCoords} color="var(--accent-primary)" />
                    </div>
                    <div className="flex flex-col gap-2 relative z-10">
                      <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Destination</label>
                      <AutocompleteInput placeholder="End location" value={destination} onChange={setDestination} onSelect={setDropoffCoords} color="var(--danger)" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Recurring Days</label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(d => (
                          <button type="button" key={d} onClick={() => toggleDay(d)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${recurringDays.includes(d) ? 'bg-primary text-background' : 'bg-surface border border-white/10 text-on-surface'}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Departure</label>
                      <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} required className="glass-input rounded-lg px-4 py-3 text-white outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Seats</label>
                      <select value={seatsOffered} onChange={e => setSeatsOffered(parseInt(e.target.value))} className="glass-input rounded-lg px-4 py-3 text-white outline-none">
                        {[...Array(maxSeats)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Price/Seat (₹)</label>
                      <input type="number" min="0" max="500" value={pricePerSeat} onChange={e => setPricePerSeat(e.target.value)} required className="glass-input rounded-lg px-4 py-3 text-white outline-none" />
                    </div>
                  </div>

                  {user.gender === 'Female' && (
                    <div className="flex items-center gap-3 bg-error-red/10 border border-error-red/30 p-4 rounded-lg cursor-pointer" onClick={() => setWomenOnly(!womenOnly)}>
                      <input type="checkbox" checked={womenOnly} readOnly className="w-4 h-4 cursor-pointer accent-error-red" />
                      <span className="text-white text-sm">Women-Only Ride (Only female colleagues can book)</span>
                    </div>
                  )}

                  <div className="mt-4">
                    <button type="submit" disabled={loading} className="w-full md:w-auto px-8 py-3 bg-primary hover:bg-primary/90 text-on-primary-fixed font-bold rounded-lg transition-colors">
                      {loading ? 'Listing...' : 'List Commute'}
                    </button>
                  </div>
                </form>
              </section>

              <div className="lg:col-span-6 min-h-[450px]">
                <MapComponent 
                  pickupCoords={pickupCoords} 
                  dropoffCoords={dropoffCoords} 
                  mapMode={mapMode} 
                  setMapMode={setMapMode} 
                  onLocationSelect={handleLocationSelect} 
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* SOS Modal */}
      {showSosModal && (
        <div className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-8 border border-error-red rounded-xl">
            <h3 className="text-error-red text-xl font-bold mb-3">🚨 Broadcast SOS Emergency?</h3>
            <p className="text-white mb-6 text-sm">This will trigger a real-time critical security alert at the Reliance command center.</p>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm text-on-surface-variant">Type of Emergency</label>
              <select value={sosType} onChange={e => setSosType(e.target.value)} className="glass-input p-3 rounded-lg text-white outline-none">
                <option value="Safety Concern">Safety Concern / Threat</option>
                <option value="Medical Emergency">Medical Emergency</option>
                <option value="Vehicle Breakdown">Vehicle Breakdown</option>
                <option value="Accident">Road Accident</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button className="glass-panel px-4 py-2 rounded-lg text-white" onClick={() => setShowSosModal(false)}>Cancel</button>
              <button className="bg-error-red px-4 py-2 rounded-lg text-white font-bold" onClick={triggerSos}>Trigger SOS Alarm</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateProfile} className="glass-panel w-full max-w-md p-8 rounded-xl flex flex-col gap-4">
            <h3 className="text-white text-xl font-bold mb-2">Edit Host Profile</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant">Full Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className="glass-input p-3 rounded-lg text-white outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant">Vehicle No.</label>
              <input type="text" value={editVehicleNo} onChange={e => setEditVehicleNo(e.target.value)} required className="glass-input p-3 rounded-lg text-white outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface-variant">Make</label>
                <input type="text" value={editVehicleMake} onChange={e => setEditVehicleMake(e.target.value)} required className="glass-input p-3 rounded-lg text-white outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface-variant">Model</label>
                <input type="text" value={editVehicleModel} onChange={e => setEditVehicleModel(e.target.value)} required className="glass-input p-3 rounded-lg text-white outline-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant">Capacity</label>
              <select value={editVehicleCapacity} onChange={e => setEditVehicleCapacity(e.target.value)} className="glass-input p-3 rounded-lg text-white outline-none">
                <option value="4+1">4+1 (Standard Car)</option>
                <option value="6+1">6+1 (SUV)</option>
                <option value="3+1">3+1 (Hatchback)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" className="glass-panel px-4 py-2 rounded-lg text-white" onClick={() => setShowProfileModal(false)}>Cancel</button>
              <button type="submit" disabled={profileLoading} className="bg-primary px-4 py-2 rounded-lg text-on-primary-fixed font-bold">Save Profile</button>
            </div>
          </form>
        </div>
      )}

      {/* AI Assistant */}
      <AIChat 
        userRole="Pool Host"
        stats={stats}
        onConfirmListing={(params) => {
          setOrigin(params.origin || '');
          setDestination(params.destination || '');
          setDepartureTime(params.time || '');
          if (params.seats) setSeatsOffered(parseInt(params.seats));
          if (params.price) setPricePerSeat(parseFloat(params.price));
          setCurrentView('new_commute');
          showToast('Commute details pre-filled from AI! Review and submit.', 'info');
        }}
      />
      <ChatModal activeChat={activeChat} setActiveChat={setActiveChat} currentUser={{ id: user.id, role: 'Pool Host' }} />
    </AppLayout>
  );
};

export default PoolHostDashboard;
