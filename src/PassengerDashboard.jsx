import React, { useState, useEffect } from 'react';
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

const PassengerDashboard = ({ user, onLogout, onUpdateUser, showToast }) => {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'discovery'
  const [stats, setStats] = useState({
    rides_taken: 0,
    avg_cost: 0,
    co2_saved: 0,
    upcoming_ride: null
  });

  const [origin, setOrigin] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destination, setDestination] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [departureTime, setDepartureTime] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [recurringDays, setRecurringDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const toggleDay = (d) => setRecurringDays(prev => prev.includes(d) ? prev.filter(day => day !== d) : [...prev, d]);
  
  const [matches, setMatches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [historyTab, setHistoryTab] = useState('Active');
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showSosModal, setShowSosModal] = useState(false);
  
  // Rating states
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateTripData, setRateTripData] = useState(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingTags, setRatingTags] = useState([]);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);
  const [sosType, setSosType] = useState('Safety Concern');
  const [mapMode, setMapMode] = useState('pickup');
  const [notifications, setNotifications] = useState([]);
  const [liveDriverLocation, setLiveDriverLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [etaMins, setEtaMins] = useState(null);

  useEffect(() => {
    // Start watching passenger's own GPS for completion swipe logic
    let watchId = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error(err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    const handleLocation = (e) => {
       if (stats.upcoming_ride && e.detail.ride_id == stats.upcoming_ride.ride_id) {
          setLiveDriverLocation({ lat: e.detail.lat, lng: e.detail.lng });
          if (e.detail.eta_mins !== undefined) setEtaMins(e.detail.eta_mins);
       }
    };
    const handleRideCompleted = () => {
       showToast('Ride completed successfully.', 'success');
       fetchStatsAndRequests();
       if (watchId) navigator.geolocation.clearWatch(watchId);
    };

    window.addEventListener('live_location', handleLocation);
    window.addEventListener('ride_completed', handleRideCompleted);
    return () => {
       window.removeEventListener('live_location', handleLocation);
       window.removeEventListener('ride_completed', handleRideCompleted);
       if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [stats.upcoming_ride, user.id]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeChat, setActiveChat] = useState({ isOpen: false, requestId: null, driverName: '' });

  const fetchStatsAndRequests = async () => {
    try {
      const statsRes = await fetch(`/api/users/${user.id}/stats`);
      if (statsRes.ok) setStats(await statsRes.json());
      const reqRes = await fetch(`/api/users/${user.id}/requests`);
      if (reqRes.ok) setRequests(await reqRes.json());
      const notifRes = await fetch(`/api/users/${user.id}/notifications`);
      if (notifRes.ok) setNotifications(await notifRes.json());
    } catch (e) {
      console.error('Error fetching passenger data:', e);
    }
  };

  useEffect(() => {
    fetchStatsAndRequests();
  }, [user.id]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return showToast('Name cannot be empty.', 'warning');
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profile updated successfully!', 'success');
        onUpdateUser(data.user);
        setShowProfileModal(false);
      } else {
        showToast(data.error || 'Failed to update profile.', 'danger');
      }
    } catch (err) {
      showToast('Network error updating profile.', 'danger');
    } finally {
      setProfileLoading(false);
    }
  };

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords || !departureTime) {
      return showToast('Please select coordinates for both Pickup and Dropoff, and specify departure time.', 'warning');
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/rides/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_id: user.id, origin_lat: pickupCoords.lat, origin_lng: pickupCoords.lng,
          dest_lat: dropoffCoords.lat, dest_lng: dropoffCoords.lng, departure_time: departureTime, women_only: womenOnly
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMatches(data.matches);
        if (data.matches.length === 0) {
          showToast('No matching rides found within limits.', 'info');
        } else if (data.expandedRadius) {
          showToast(`Expanded search radius to 5km! Found ${data.matches.length} matches.`, 'warning');
        } else {
          showToast(`Found ${data.matches.length} matching ride options!`, 'success');
        }
      } else {
        showToast(data.error || 'Failed to search for rides.', 'danger');
      }
    } catch (err) {
      showToast('Network error during matching.', 'danger');
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePostNeed = async (e) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords || !departureTime || recurringDays.length === 0) {
      return showToast('Please fill all fields and select at least one day.', 'warning');
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/passenger-listings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_id: user.id, origin, destination,
          origin_lat: pickupCoords.lat, origin_lng: pickupCoords.lng,
          dest_lat: dropoffCoords.lat, dest_lng: dropoffCoords.lng,
          departure_time: departureTime, recurring_days: recurringDays.join(',')
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Commute need posted successfully! Hosts can now offer you rides.', 'success');
        setCurrentView('dashboard');
        setOrigin(''); setDestination(''); setPickupCoords(null); setDropoffCoords(null); setDepartureTime('');
      } else {
        showToast(data.error || 'Failed to post need.', 'danger');
      }
    } catch (err) { showToast('Network error.', 'danger'); }
    finally { setSearchLoading(false); }
  };

  const handleRequestRide = async (rideId, driverName) => {
    setActionLoading(rideId);
    try {
      const res = await fetch(`/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ride_id: rideId, 
          passenger_id: user.id,
          pickup_lat: pickupCoords?.lat || null,
          pickup_lng: pickupCoords?.lng || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Request successfully sent to ${driverName}!`, 'success');
        fetchStatsAndRequests();
        setMatches(prev => prev.filter(m => m.id !== rideId));
      } else {
        showToast(data.error || 'Failed to request ride.', 'danger');
      }
    } catch (err) {
      showToast('Network error while requesting ride.', 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async (requestId, driverName) => {
    if (!window.confirm(`Mark ${driverName} as a No-Show? They will be penalized.`)) return;
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/rides/request/${requestId}/no-show`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_by_role: 'Passenger' })
      });
      if (res.ok) { showToast(`Reported ${driverName} as a No-Show.`, 'success'); fetchStatsAndRequests(); }
      else { const data = await res.json(); showToast(data.error || 'Failed to report no-show.', 'danger'); }
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
        showToast('CRITICAL: SOS alarm transmitted to Command Center.', 'danger');
        setShowSosModal(false);
      }
    } catch (err) {
      showToast('Network error triggering SOS.', 'danger');
    }
  };

  const handleOfferResponse = async (requestId, action) => {
    try {
      const res = await fetch(`/api/rides/request/${requestId}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Offer ${action}ed successfully!`, 'success');
        fetchStatsAndRequests();
      } else {
        showToast(data.error || `Failed to ${action} offer.`, 'danger');
      }
    } catch (err) {
      showToast('Network error.', 'danger');
    }
  };

  const availableTags = ["On Time", "Clean Vehicle", "Safe Driving", "Great Conversation", "Late", "Rash Driving", "Harassment", "Unsafe Driving", "Dirty Vehicle"];

  const handleToggleTag = (tag) => {
    setRatingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (ratingStars === 0) return showToast('Please select a star rating.', 'warning');
    if (ratingStars < 3 && ratingComment.trim() === '') return showToast('Please provide a comment for low ratings.', 'warning');

    setRatingLoading(true);
    try {
      const res = await fetch(`/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: rateTripData.ride_id,
          ratee_id: rateTripData.driver_id,
          stars: ratingStars,
          tags: ratingTags.join(','),
          comment: ratingComment
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Rating submitted successfully! Thank you.', 'success');
        setShowRateModal(false);
        // Refresh requests to update state (assuming backend could mark it as rated, but for now we just close)
      } else {
        showToast(data.error || 'Failed to submit rating.', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error.', 'danger');
    } finally {
      setRatingLoading(false);
    }
  };

  const navItems = [
    { id: 'new', label: 'Book New Ride', icon: 'add', isPrimaryAction: true, onClick: () => setCurrentView('discovery') },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', onClick: () => setCurrentView('dashboard') },
    { id: 'discovery', label: 'Ride Discovery', icon: 'travel_explore', onClick: () => setCurrentView('discovery') },
    { id: 'past_rides', label: 'Past Rides', icon: 'history', onClick: () => setCurrentView('past_rides') }
  ];

  return (
    <>
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
              {/* Welcome Header */}
              <header className="mb-8 flex justify-between items-end">
                <div>
                  <p className="font-body-md text-body-md text-primary mb-1">Welcome back, {user.name}</p>
                  <h2 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface">Your Commute Overview</h2>
                </div>
                <div className="hidden md:flex items-center gap-2 text-on-surface-variant font-label-md text-label-md bg-surface-container px-4 py-2 rounded-full border border-white/5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Network Status: Optimal
                </div>
              </header>

              {/* Bento Grid Layout */}
              <div className="grid grid-cols-4 lg:grid-cols-12 gap-gutter-mobile lg:gap-gutter-desktop">
                
                {/* Primary ESG Metrics Card (Spans 8 cols on desktop) */}
                <div className="col-span-4 lg:col-span-8 bg-glass-fill backdrop-blur-xl border border-white/10 rounded-xl p-6 lg:p-8 relative overflow-hidden group">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px] opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">eco</span>
                      ESG Impact
                    </h3>
                    <span className="font-label-md text-label-md bg-surface-container px-3 py-1 rounded-full text-on-surface-variant border border-white/5">YTD 2024</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                    <div className="col-span-2 bg-surface-container/50 border border-white/5 rounded-lg p-5 hover:bg-surface-bright/20 transition-all duration-300">
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">Carbon Footprint Reduced</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-xl text-headline-xl text-primary drop-shadow-[0_0_10px_rgba(103,218,182,0.3)]">{stats.co2_saved}</span>
                        <span className="font-body-md text-body-md text-on-surface-variant">kg CO₂</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-accent-green mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_up</span>
                        Top 15% in Engineering
                      </p>
                    </div>
                    <div className="col-span-2 bg-surface-container/50 border border-white/5 rounded-lg p-5 hover:bg-surface-bright/20 transition-all duration-300">
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">Commute Savings</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-xl text-headline-xl text-secondary drop-shadow-[0_0_10px_rgba(114,210,253,0.3)]">₹{(stats.rides_taken * stats.avg_cost).toFixed(0)}</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-secondary-fixed-dim mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>savings</span>
                        Reinvested to corporate pool
                      </p>
                    </div>
                    <div className="bg-surface-container/50 border border-white/5 rounded-lg p-5 hover:bg-surface-bright/20 transition-all duration-300 flex flex-col justify-between">
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">Total Rides Taken</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-xl text-headline-xl text-tertiary drop-shadow-[0_0_10px_rgba(140,218,109,0.3)]">{stats.rides_taken}</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>directions_car</span>
                        Completed trips
                      </p>
                    </div>
                    <div className="bg-surface-container/50 border border-white/5 rounded-lg p-5 hover:bg-surface-bright/20 transition-all duration-300 flex flex-col justify-between">
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">Avg Cost / Ride</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-xl text-headline-xl text-accent-blue drop-shadow-[0_0_10px_rgba(80,180,252,0.3)]">₹{stats.avg_cost}</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>receipt</span>
                        Per trip average
                      </p>
                    </div>
                    <div className="bg-surface-container/50 border border-white/5 rounded-lg p-5 hover:bg-surface-bright/20 transition-all duration-300 flex flex-col justify-between">
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">On-Time Trips</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-xl text-headline-xl text-warning-orange drop-shadow-[0_0_10px_rgba(251,140,0,0.3)]">94%</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>schedule</span>
                        Punctuality score
                      </p>
                    </div>
                    <div className="bg-surface-container/50 border border-white/5 rounded-lg p-5 hover:bg-surface-bright/20 transition-all duration-300 flex flex-col justify-between">
                      <p className="font-label-md text-label-md text-on-surface-variant mb-2">Safety Score</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-xl text-headline-xl text-primary drop-shadow-[0_0_10px_rgba(103,218,182,0.3)]">A+</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shield</span>
                        Verified hosts only
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upcoming Ride Card (Spans 4 cols on desktop) */}
                <div className="col-span-4 lg:col-span-4 bg-glass-fill backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden flex flex-col">
                  {stats.upcoming_ride ? (
                    <>
                      <div className="h-32 bg-surface-container relative">
                        <img alt="Map Route Background" className="w-full h-full object-cover opacity-50" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBaR7rxY6YNpFft5NUsGMVsl3nn02bMOI_Wu6Fmam_v_S5JeFeegsAhLkfiXoc6ccoOuQGnK9_k_eXeMPH8zumwiDl1qdAcgN6DIPPmBIBMJP5_fFiUEsydW_Blf7-aAqoirR_HOU0ZBu2a7WWYPxr-ozj0sygb5ZGFhuGEFc3vjU8IHI28_2l_PjCKYGSWS5xmsQwOwzTug4tWLNl-S5fFYuWsAh35sVDMlznrelhfLULCJQXtGDsumqXi7DiNb6Db3qdpwj107lw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-deep/90 to-transparent"></div>
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                          <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-1 rounded text-xs font-bold tracking-wider uppercase backdrop-blur-md">Upcoming</span>
                          <span className="font-label-md text-label-md text-on-surface bg-surface-deep/80 px-2 py-1 rounded backdrop-blur-md">{stats.upcoming_ride.departure_time}</span>
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col relative">
                        <div className="absolute left-[34px] top-[32px] bottom-[80px] w-[2px] bg-gradient-to-b from-primary to-secondary rounded-full opacity-50"></div>
                        <div className="flex items-start gap-4 mb-4 relative z-10">
                          <div className="w-6 h-6 rounded-full bg-surface-deep border-2 border-primary flex items-center justify-center shrink-0 mt-1">
                            <span className="w-2 h-2 rounded-full bg-primary"></span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-label-md text-label-md text-on-surface-variant">Pickup</p>
                            <p className="font-body-md text-body-md text-on-surface truncate" title={stats.upcoming_ride.origin}>{stats.upcoming_ride.origin}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 mb-6 relative z-10">
                          <div className="w-6 h-6 rounded-full bg-surface-deep border-2 border-secondary flex items-center justify-center shrink-0 mt-1">
                            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }}>location_on</span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-label-md text-label-md text-on-surface-variant">Dropoff</p>
                            <p className="font-body-md text-body-md text-on-surface truncate" title={stats.upcoming_ride.destination}>{stats.upcoming_ride.destination}</p>
                          </div>
                        </div>
                        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container overflow-hidden flex justify-center items-center font-bold text-primary">
                              {stats.upcoming_ride.driver_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-label-md text-label-md text-on-surface leading-tight">{stats.upcoming_ride.driver_name}</p>
                              <p className="text-xs text-on-surface-variant">Host</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setCurrentView('tracking')} 
                              className="text-primary hover:text-white transition-colors bg-primary/20 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">my_location</span>
                              Track
                            </button>
                            <button 
                              className="text-primary hover:text-white transition-colors"
                              onClick={() => {
                                // Find the accepted request for this upcoming ride
                                const acceptedReq = requests.find(r => r.ride_id === stats.upcoming_ride?.ride_id && r.request_status === 'Accepted');
                                if (acceptedReq) {
                                  setActiveChat({ isOpen: true, requestId: acceptedReq.request_id, driverName: stats.upcoming_ride.driver_name });
                                } else {
                                  showToast('Chat is only available for accepted rides.', 'warning');
                                }
                              }}
                            >
                              <span className="material-symbols-outlined">chat_bubble</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 flex flex-1 items-center justify-center text-on-surface-variant italic">No upcoming trips scheduled.</div>
                  )}
                </div>

                {/* Quick Action CTA Card (Mobile focus, spans 12/6) */}
                <div className="col-span-4 lg:col-span-6 bg-glass-fill backdrop-blur-xl border border-white/10 rounded-xl p-8 flex flex-col justify-center items-center text-center group hover:bg-surface-bright/10 transition-all duration-300 lg:hidden" onClick={() => setCurrentView('discovery')}>
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-primary text-[32px]">directions_car</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Need a ride home?</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">Connect with corporate hosts heading your way.</p>
                  <button className="w-full bg-primary text-on-primary-container font-label-lg text-label-lg py-3 rounded-lg hover:shadow-[0_0_15px_rgba(2,150,118,0.4)] transition-all duration-300">
                    Book New Ride
                  </button>
                </div>
              </div>

              {/* Ride Requests Table */}
              <div className="mt-8 glass-panel rounded-xl p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl text-white font-bold">Active Ride Requests</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-on-surface-variant text-sm">
                        <th className="pb-3 font-medium">Route</th>
                        <th className="pb-3 font-medium">Host</th>
                        <th className="pb-3 font-medium">Departure</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.filter(req => (req.ride_status === 'Scheduled' || req.ride_status === 'In Progress')).map(req => (
                        <tr key={req.request_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-4 font-bold">{req.origin} → {req.destination}</td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              {req.driver_avatar_url ? (
                                <img src={req.driver_avatar_url} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">{req.driver_name.charAt(0)}</div>
                              )}
                              <span>{req.driver_name}</span>
                            </div>
                          </td>
                          <td className="py-4">{req.departure_time}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs ${req.request_status === 'Accepted' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-warning-orange/20 text-warning-orange border border-warning-orange/30'}`}>
                              {req.ride_status || req.request_status}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex gap-2 items-center">
                              {req.request_status === 'Offered' && req.ride_status === 'Scheduled' && (
                                <>
                                  <button onClick={() => handleOfferResponse(req.request_id, 'accept')} className="flex items-center gap-1 text-primary hover:text-white border border-primary/30 hover:bg-primary/20 px-2 py-1 rounded text-xs transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">check</span> Accept
                                  </button>
                                  <button onClick={() => handleOfferResponse(req.request_id, 'reject')} className="flex items-center gap-1 text-warning-orange hover:text-white border border-warning-orange/30 hover:bg-warning-orange/20 px-2 py-1 rounded text-xs transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">close</span> Decline
                                  </button>
                                </>
                              )}
                              {req.request_status === 'Accepted' && (req.ride_status === 'Scheduled' || req.ride_status === 'In Progress') && (
                                <>
                                  <button
                                    onClick={() => setActiveChat({ isOpen: true, requestId: req.request_id, driverName: req.driver_name })}
                                    className="flex items-center gap-1 text-primary hover:text-white border border-primary/30 hover:bg-primary/20 px-2 py-1 rounded text-xs transition-colors"
                                    title="Chat with host"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                    Chat
                                  </button>
                                  <button
                                    onClick={() => handleNoShow(req.request_id, req.driver_name)}
                                    className="flex items-center gap-1 text-error-red hover:text-white border border-error-red/30 hover:bg-error-red/20 px-2 py-1 rounded text-xs transition-colors ml-2"
                                    title="Host didn't show up?"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">person_off</span>
                                    No-Show
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {requests.filter(req => (req.ride_status === 'Scheduled' || req.ride_status === 'In Progress')).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-on-surface-variant italic">No active requests found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : currentView === 'past_rides' ? (
            <div className="mt-8 glass-panel rounded-xl p-8">
              <h3 className="text-xl text-white font-bold mb-6">Past Rides</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-on-surface-variant text-sm">
                      <th className="pb-3 font-medium">Route</th>
                      <th className="pb-3 font-medium">Host</th>
                      <th className="pb-3 font-medium">Departure</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.filter(req => (req.ride_status !== 'Scheduled' && req.ride_status !== 'In Progress')).map(req => (
                      <tr key={req.request_id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-4 font-bold">{req.origin} → {req.destination}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            {req.driver_avatar_url ? (
                              <img src={req.driver_avatar_url} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">{req.driver_name.charAt(0)}</div>
                            )}
                            <span>{req.driver_name}</span>
                          </div>
                        </td>
                        <td className="py-4">{req.departure_time}</td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded text-xs ${req.request_status === 'Accepted' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-warning-orange/20 text-warning-orange border border-warning-orange/30'}`}>
                            {req.ride_status || req.request_status}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex gap-2 items-center">
                            {req.ride_status === 'Completed' && req.request_status === 'Accepted' && (
                              <button
                                onClick={() => {
                                  setRateTripData({ ride_id: req.ride_id, driver_id: req.driver_id, driver_name: req.driver_name });
                                  setShowRateModal(true);
                                }}
                                className="flex items-center gap-1 text-accent-blue hover:text-white border border-accent-blue/30 hover:bg-accent-blue/20 px-2 py-1 rounded text-xs transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">star</span>
                                Rate Host
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {requests.filter(req => (req.ride_status !== 'Scheduled' && req.ride_status !== 'In Progress')).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-on-surface-variant italic">No past rides.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : currentView === 'settings' ? (
            <Settings user={user} showToast={showToast} onUpdateUser={onUpdateUser} />
          ) : currentView === 'tracking' ? (
            <div className="flex flex-col h-full gap-6">
               <header className="mb-2 flex justify-between items-end flex-wrap gap-4">
                 <div>
                   <div className="flex items-center gap-3 mb-2">
                     <h1 className="text-3xl text-white font-bold">Live Trip Tracker</h1>
                     {etaMins !== null && (
                       <span className="bg-tertiary/20 text-tertiary border border-tertiary/30 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                         ETA: {etaMins} mins
                       </span>
                     )}
                   </div>
                   <p className="text-on-surface-variant">Follow your host's location in real-time.</p>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="w-64 hidden sm:block">
                     <SwipeToComplete 
                       onComplete={async () => {
                         setActionLoading('complete');
                         try {
                           await fetch(`/api/rides/${stats.upcoming_ride.ride_id}/complete`, { method: 'POST' });
                         } catch (e) {
                           console.error(e);
                         } finally {
                           setActionLoading(null);
                         }
                       }}
                       disabled={getDistanceFromLatLonInKm(currentLocation?.lat, currentLocation?.lng, stats.upcoming_ride?.dest_lat, stats.upcoming_ride?.dest_lng) > 0.25 || actionLoading === 'complete'}
                       label={getDistanceFromLatLonInKm(currentLocation?.lat, currentLocation?.lng, stats.upcoming_ride?.dest_lat, stats.upcoming_ride?.dest_lng) > 0.25 ? 'Too far to complete' : 'Slide to Complete'}
                     />
                   </div>
                   <button onClick={() => setCurrentView('dashboard')} className="btn-secondary px-6 py-2 rounded-lg font-bold">Back to Dashboard</button>
                 </div>
               </header>
               <div className="w-full sm:hidden mb-4">
                 <SwipeToComplete 
                   onComplete={async () => {
                     setActionLoading('complete');
                     try {
                       await fetch(`/api/rides/${stats.upcoming_ride.ride_id}/complete`, { method: 'POST' });
                     } catch (e) {
                       console.error(e);
                     } finally {
                       setActionLoading(null);
                     }
                   }}
                   disabled={getDistanceFromLatLonInKm(currentLocation?.lat, currentLocation?.lng, stats.upcoming_ride?.dest_lat, stats.upcoming_ride?.dest_lng) > 0.25 || actionLoading === 'complete'}
                   label={getDistanceFromLatLonInKm(currentLocation?.lat, currentLocation?.lng, stats.upcoming_ride?.dest_lat, stats.upcoming_ride?.dest_lng) > 0.25 ? 'Too far to complete' : 'Slide to Complete'}
                 />
               </div>
               <div className="flex-1 min-h-[500px]">
                 <MapComponent 
                    pickupCoords={stats.upcoming_ride ? {lat: stats.upcoming_ride.origin_lat, lng: stats.upcoming_ride.origin_lng, name: stats.upcoming_ride.origin} : null} 
                    dropoffCoords={stats.upcoming_ride ? {lat: stats.upcoming_ride.dest_lat, lng: stats.upcoming_ride.dest_lng, name: stats.upcoming_ride.destination} : null} 
                    mapMode={null} 
                    setMapMode={null} 
                    onLocationSelect={null} 
                    routePolyline={stats.upcoming_ride?.route_polyline}
                    liveDriverLocation={liveDriverLocation}
                  />
               </div>
            </div>
          ) : (
            <>
              <header className="mb-8">
                <h1 className="text-3xl text-white font-bold mb-2">Find Your Commute</h1>
                <p className="text-on-surface-variant">Discover safe, secure rides with verified colleagues.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-6 flex flex-col gap-6">
                  <section className="glass-panel rounded-xl p-6 shadow-lg">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Locations */}
                      <div className="col-span-1 md:col-span-12 relative flex flex-col gap-4">
                        <div className="relative z-10 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-surface-bright flex items-center justify-center border border-white/10 shrink-0">
                            <span className="material-symbols-outlined text-primary text-sm">my_location</span>
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-semibold">Origin</label>
                            <AutocompleteInput placeholder="Search location" value={origin} onChange={setOrigin} onSelect={setPickupCoords} color="var(--accent-primary)" />
                          </div>
                        </div>
                        <div className="relative z-10 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-semibold">Destination</label>
                            <AutocompleteInput placeholder="Where to?" value={destination} onChange={setDestination} onSelect={setDropoffCoords} color="var(--danger)" />
                          </div>
                        </div>
                      </div>
                      {/* Time & Filter */}
                      <div className="col-span-1 md:col-span-12 flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-semibold">Departure Time</label>
                            <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} required className="w-full glass-input rounded-lg px-4 py-3 text-white h-[46px]" />
                          </div>
                          {user.gender === 'Female' && (
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-semibold">Safety Options</label>
                              <div className="flex items-center gap-2 h-[46px] glass-input rounded-lg px-4 cursor-pointer" onClick={() => setWomenOnly(!womenOnly)}>
                                <span className="material-symbols-outlined text-accent-green">verified_user</span>
                                <span className="text-sm text-white">Female Hosts Only</span>
                                <input type="checkbox" checked={womenOnly} readOnly className="ml-auto" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-2 font-semibold">Recurring Days (For Posting Commute Need)</label>
                          <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map(d => (
                              <button type="button" key={d} onClick={() => toggleDay(d)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${recurringDays.includes(d) ? 'bg-primary text-background' : 'bg-surface border border-white/10 text-on-surface'}`}>
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Action */}
                      <div className="col-span-1 md:col-span-12 flex flex-col md:flex-row gap-4 justify-end mt-2">
                        <button type="button" onClick={handlePostNeed} disabled={searchLoading} className="flex-1 btn-secondary py-3 rounded-lg font-bold flex items-center justify-center gap-2 h-[46px] border border-primary/50 text-primary hover:bg-primary/10">
                          <span className="material-symbols-outlined">post_add</span>
                          {searchLoading ? 'Posting...' : 'Post Commute Need'}
                        </button>
                        <button type="submit" disabled={searchLoading} className="flex-1 btn-primary py-3 rounded-lg font-bold flex items-center justify-center gap-2 h-[46px]">
                          <span className="material-symbols-outlined">search</span>
                          {searchLoading ? 'Searching...' : 'Search Hosts'}
                        </button>
                      </div>
                    </form>
                  </section>

                  {matches.length > 0 && (
                    <div className="flex flex-col gap-6">
                      <h2 className="text-xl text-white font-bold">Available Commutes</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {matches.map(ride => (
                          <article key={ride.id} className="glass-panel rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 group flex flex-col">
                            <div className="p-5 flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                  <div className="w-12 h-12 rounded-full border border-white/10 bg-surface-bright flex items-center justify-center font-bold text-lg text-primary overflow-hidden">
                                    {ride.driver_avatar_url ? (
                                      <img src={ride.driver_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                      ride.driver_name.charAt(0)
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">{ride.driver_name}</h3>
                                    <p className="text-sm text-on-surface-variant flex items-center gap-1">
                                      {ride.vehicle_make} {ride.vehicle_model}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-4 mb-4 relative">
                                <div className="route-gradient absolute left-[7px] top-2 bottom-2 opacity-50"></div>
                                <div className="flex flex-col justify-between py-1 z-10 w-4 items-center">
                                  <div className="w-2 h-2 rounded-full bg-white/50"></div>
                                  <div className="w-2 h-2 rounded-full bg-accent-blue/50"></div>
                                </div>
                                <div className="flex-1 flex flex-col gap-4">
                                  <div>
                                    <p className="font-medium text-white">{ride.departure_time}</p>
                                    <p className="text-sm text-on-surface-variant truncate">{ride.origin}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">Drop-off</p>
                                    <p className="text-sm text-on-surface-variant truncate">{ride.destination}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="px-5 py-4 bg-surface-bright/20 border-t border-white/5 flex justify-between items-center mt-auto">
                              <div className="flex gap-3">
                                <div className="flex items-center gap-1 text-on-surface-variant bg-surface-base px-2 py-1 rounded-md border border-white/5">
                                  <span className="material-symbols-outlined text-sm">airline_seat_recline_normal</span>
                                  <span className="text-sm">{ride.seats_offered} Left</span>
                                </div>
                              </div>
                              <button onClick={() => handleRequestRide(ride.id, ride.driver_name)} disabled={actionLoading === ride.id} className="btn-primary px-4 py-2 rounded-lg text-sm font-bold">
                                {actionLoading === ride.id ? 'Sending...' : `Request ₹${ride.price_per_seat}`}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
      </AppLayout>

      {/* SOS Modal */}
      {showSosModal && (
        <div className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-8 border border-error-red rounded-xl">
            <h3 className="text-error-red text-xl font-bold mb-3">🚨 Broadcast SOS Emergency?</h3>
            <p className="text-white mb-6 text-sm">This will trigger a real-time critical security alert at the Reliance command center.</p>
            <div className="flex justify-end gap-3">
              <button className="glass-panel px-4 py-2 rounded-lg text-white" onClick={() => setShowSosModal(false)}>Cancel</button>
              <button className="bg-error-red px-4 py-2 rounded-lg text-white font-bold" onClick={triggerSos}>Trigger SOS Alarm</button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Trip Modal */}
      {showRateModal && rateTripData && (
        <div className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-8 rounded-xl border border-white/10">
            <h3 className="text-white text-xl font-bold mb-2">Rate Your Trip</h3>
            <p className="text-sm text-on-surface-variant mb-6">How was your ride with {rateTripData.driver_name}?</p>
            
            <form onSubmit={handleSubmitRating} className="flex flex-col gap-6">
              {/* Star Rating */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button type="button" key={star} onClick={() => setRatingStars(star)} className={`text-4xl transition-transform ${ratingStars >= star ? 'text-warning-orange scale-110' : 'text-surface-bright hover:scale-110'}`}>
                    ★
                  </button>
                ))}
              </div>

              {/* Tags */}
              <div>
                <p className="text-sm text-on-surface-variant mb-2">Select feedback tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => {
                    const isNegative = ["Late", "Rash Driving", "Harassment", "Unsafe Driving", "Dirty Vehicle"].includes(tag);
                    const isSelected = ratingTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => handleToggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${isSelected ? (isNegative ? 'bg-error-red text-white border-error-red' : 'bg-primary text-white border-primary') : 'bg-surface-bright text-on-surface-variant border-transparent'} border`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Comment */}
              <div className="flex flex-col gap-1">
                <label className="text-sm text-on-surface-variant">Comments <span className="text-error-red">{ratingStars > 0 && ratingStars < 3 ? '(Required for ratings < 3)' : '(Optional)'}</span></label>
                <textarea 
                  value={ratingComment} 
                  onChange={e => setRatingComment(e.target.value)} 
                  className="glass-input p-3 rounded-lg text-white outline-none min-h-[80px]"
                  placeholder="Share details about your experience..."
                  required={ratingStars > 0 && ratingStars < 3}
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" className="glass-panel px-4 py-2 rounded-lg text-white" onClick={() => setShowRateModal(false)}>Cancel</button>
                <button type="submit" disabled={ratingLoading} className="btn-primary px-6 py-2 rounded-lg font-bold">
                  {ratingLoading ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating SOS Button */}
      <button onClick={() => setShowSosModal(true)} className="fixed bottom-8 right-8 w-14 h-14 bg-error-red rounded-full shadow-[0_0_20px_rgba(229,57,53,0.4)] flex items-center justify-center z-50 hover:scale-105 transition-transform animate-[pulse_3s_infinite]">
        <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_police</span>
      </button>

      {/* AI Assistant */}
      <AIChat 
        userRole="Passenger"
        stats={stats}
        onConfirmBooking={(params) => {
          setOrigin(params.origin || '');
          setDestination(params.destination || '');
          setDepartureTime(params.time || '');
          setCurrentView('discovery');
          showToast('Ride details pre-filled! Set your coordinates and search.', 'info');
        }}
      />
      <ChatModal activeChat={activeChat} setActiveChat={setActiveChat} currentUser={{ id: user.id, role: 'Passenger' }} />
    </>
  );
};

export default PassengerDashboard;
