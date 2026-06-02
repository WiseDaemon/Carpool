import React, { useState } from 'react';

const Registration = ({ showToast, onLoginClick }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Passenger', // Default role
    hasVehiclePass: false,
    vehicleNo: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleCapacity: '4+1',
    gender: ''
  });

  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleRoleSelection = (role) => {
    setFormData({ ...formData, role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch(`/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: 'Registration successful! Welcome to Reliance Carpool.' });
        if (showToast) showToast(`Successfully registered ${formData.name} as a ${formData.role}!`, 'success');
        setFormData({ name: '', email: '', password: '', role: 'Passenger', hasVehiclePass: false, vehicleNo: '', vehicleMake: '', vehicleModel: '', vehicleCapacity: '4+1', gender: '' }); // Reset form
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to register. Please try again.' });
        if (showToast) showToast(data.error || 'Failed to register user.', 'danger');
      }
    } catch (error) {
      console.error('Registration Error:', error);
      setStatus({ type: 'error', message: 'Network error. Make sure the backend server is running.' });
      if (showToast) showToast('Network error: server is unreachable.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-transparent p-6">
      <div className="glass-panel animate-slide-in w-full max-w-[500px] p-8 rounded-2xl flex flex-col gap-6">
        
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent-blue mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-[0_0_15px_rgba(103,218,182,0.3)]">
            R
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Join the Network</h2>
          <p className="text-on-surface-variant text-sm mt-1">Register to ride or drive with colleagues.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          {/* Role Selection */}
          <div className="flex gap-3">
            <div 
              onClick={() => handleRoleSelection('Passenger')}
              className={`flex-1 p-3 text-center rounded-lg cursor-pointer transition-all duration-300 border ${
                formData.role === 'Passenger' 
                  ? 'bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(103,218,182,0.2)]' 
                  : 'bg-surface-container/50 text-on-surface-variant border-white/10 hover:bg-surface-bright/20'
              }`}
            >
              <div className="fontWeight-bold text-sm">Passenger</div>
              <div className="text-[10px] opacity-70">I need a ride</div>
            </div>

            <div 
              onClick={() => handleRoleSelection('Pool Host')}
              className={`flex-1 p-3 text-center rounded-lg cursor-pointer transition-all duration-300 border ${
                formData.role === 'Pool Host' 
                  ? 'bg-tertiary/20 text-tertiary border-tertiary shadow-[0_0_10px_rgba(140,218,109,0.2)]' 
                  : 'bg-surface-container/50 text-on-surface-variant border-white/10 hover:bg-surface-bright/20'
              }`}
            >
              <div className="fontWeight-bold text-sm">Pool Host</div>
              <div className="text-[10px] opacity-70">I'm driving</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Full Name</label>
              <input 
                type="text" 
                name="name"
                placeholder="e.g. Rohan Sharma" 
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full glass-input rounded-lg px-4 py-2.5 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Gender</label>
              <select 
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
                className="w-full glass-input rounded-lg px-4 py-2.5 text-white outline-none text-body-md focus:border-primary transition-all bg-[rgba(19,23,34,0.4)]"
              >
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer Not to Say">Prefer Not to Say</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Corporate Email</label>
              <input 
                type="email" 
                name="email"
                placeholder="e.g. rohan.s@ril.com" 
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full glass-input rounded-lg px-4 py-2.5 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Password</label>
              <input 
                type="password" 
                name="password"
                placeholder="Create a password" 
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full glass-input rounded-lg px-4 py-2.5 text-white placeholder:text-on-surface-variant/30 outline-none text-body-md focus:border-primary transition-all"
              />
            </div>
          </div>

          {formData.role === 'Pool Host' && (
            <div className="flex flex-col gap-4 bg-white/2 p-4 rounded-xl border border-white/10">
              <div className="text-sm text-tertiary font-bold">Vehicle Details (One-time Setup)</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">Vehicle Make</label>
                  <input type="text" name="vehicleMake" placeholder="e.g. Maruti Suzuki" value={formData.vehicleMake} onChange={handleInputChange} required className="w-full glass-input rounded-lg px-3 py-2 text-white outline-none text-body-sm focus:border-primary transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">Vehicle Model</label>
                  <input type="text" name="vehicleModel" placeholder="e.g. Swift" value={formData.vehicleModel} onChange={handleInputChange} required className="w-full glass-input rounded-lg px-3 py-2 text-white outline-none text-body-sm focus:border-primary transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">Vehicle Registration No.</label>
                  <input type="text" name="vehicleNo" placeholder="MH 04 AB 1234" value={formData.vehicleNo} onChange={handleInputChange} required className="w-full glass-input rounded-lg px-3 py-2 text-white outline-none text-body-sm focus:border-primary transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">Capacity</label>
                  <select name="vehicleCapacity" value={formData.vehicleCapacity} onChange={handleInputChange} className="w-full glass-input rounded-lg px-3 py-2 text-white outline-none text-body-sm focus:border-primary transition-all bg-[rgba(19,23,34,0.4)]">
                    <option value="4+1">4+1 Seater</option>
                    <option value="5+1">5+1 Seater</option>
                    <option value="6+1">6+1 Seater</option>
                    <option value="7+1">7+1 Seater</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="hasVehiclePass"
                  name="hasVehiclePass"
                  checked={formData.hasVehiclePass}
                  onChange={handleInputChange}
                  className="w-4 h-4 cursor-pointer accent-tertiary"
                />
                <label htmlFor="hasVehiclePass" className="text-sm text-on-surface-variant cursor-pointer">
                  I have a valid RCP Vehicle Gate Pass
                </label>
              </div>
            </div>
          )}

          {status.message && (
            <div className={`p-3 rounded-lg text-sm text-center border ${
              status.type === 'success' 
                ? 'bg-tertiary/10 text-tertiary border-tertiary' 
                : 'bg-error-red/10 text-error-red border-error-red/30'
            }`}>
              {status.message}
            </div>
          )}

          <button 
            type="submit" 
            className={`w-full py-3 rounded-lg text-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-98 bg-gradient-to-r ${
              formData.role === 'Passenger' 
                ? 'from-primary to-accent-teal hover:shadow-[0_0_15px_rgba(103,218,182,0.4)]' 
                : 'from-tertiary to-accent-green hover:shadow-[0_0_15px_rgba(140,218,109,0.4)]'
            }`}
            disabled={loading}
          >
            {loading ? 'Registering...' : `Register as ${formData.role}`}
          </button>
        </form>

        <div className="text-center text-sm text-on-surface-variant mt-2">
          Already have an account?{' '}
          <span onClick={onLoginClick} className="text-primary font-bold hover:underline cursor-pointer">
            Login here
          </span>
        </div>
      </div>
    </div>
  );
};

export default Registration;
