import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const monthlyData = [
  { month: 'Jan', co2: 4000, fuel: 1200, cost: 100000 },
  { month: 'Feb', co2: 4500, fuel: 1350, cost: 112000 },
  { month: 'Mar', co2: 5200, fuel: 1560, cost: 130000 },
  { month: 'Apr', co2: 4800, fuel: 1440, cost: 120000 },
  { month: 'May', co2: 6100, fuel: 1830, cost: 152000 },
  { month: 'Jun', co2: 6800, fuel: 2040, cost: 170000 },
];

const buData = [
  { name: 'Jio Platforms', fuelSaved: 4200 },
  { name: 'Reliance Retail', fuelSaved: 3800 },
  { name: 'RIL (O2C)', fuelSaved: 2900 },
  { name: 'Reliance Foundation', fuelSaved: 1200 },
];

const ESGDashboard = () => {
  const [renderChart, setRenderChart] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setRenderChart(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="animate-slide-in flex flex-col gap-6">
      
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/85 transition-all duration-300 border-l-4 border-l-tertiary">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-tertiary text-[28px]">eco</span>
            <span className="text-xs bg-tertiary/10 text-tertiary px-2 py-0.5 rounded font-semibold uppercase tracking-wider">CO₂ Offset</span>
          </div>
          <div>
            <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">CO₂ Avoided</p>
            <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">31,400 kg</h3>
            <p className="text-xs text-accent-green mt-2 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> Last 6 Months Total
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/85 transition-all duration-300 border-l-4 border-l-primary">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-primary text-[28px]">local_gas_station</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Efficiency</span>
          </div>
          <div>
            <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">Fuel Saved</p>
            <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">9,420 Litres</h3>
            <p className="text-xs text-accent-green mt-2 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> Est. ARAI norms
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/85 transition-all duration-300 border-l-4 border-l-warning-orange">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-warning-orange text-[28px]">payments</span>
            <span className="text-xs bg-warning-orange/10 text-warning-orange px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Savings</span>
          </div>
          <div>
            <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">Employee ₹ Saved</p>
            <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">₹ 7,84,000</h3>
            <p className="text-xs text-accent-green mt-2 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> Total Cost Shared
            </p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-glass-fill/85 transition-all duration-300 border-l-4 border-l-secondary">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-secondary text-[28px]">nature</span>
            <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Forestry</span>
          </div>
          <div>
            <p className="font-label-lg text-label-lg text-on-surface-variant mb-1">Trees Equivalent</p>
            <h3 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">1,450</h3>
            <p className="text-xs text-accent-green mt-2 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> Based on CO₂ offset
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4">
        
        {/* Main Area Chart */}
        <div className="glass-panel p-6 rounded-xl min-w-0">
          <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 mb-5">CO₂ Avoided Trend</h3>
          <div className="w-full h-[350px]">
            {renderChart ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8cda6d" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8cda6d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#87948d" />
                  <YAxis stroke="#87948d" />
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1d2026', borderColor: 'rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: '8px' }}
                    itemStyle={{ color: '#8cda6d' }}
                  />
                  <Area type="monotone" dataKey="co2" name="CO₂ Avoided (kg)" stroke="#8cda6d" fillOpacity={1} fill="url(#colorCo2)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant/40">
                Loading chart...
              </div>
            )}
          </div>
        </div>

        {/* Side Bar Chart */}
        <div className="glass-panel p-6 rounded-xl min-w-0">
          <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 mb-5">Fuel Saved by BU (L)</h3>
          <div className="w-full h-[350px]">
            {renderChart ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" horizontal={false} />
                  <XAxis type="number" stroke="#87948d" />
                  <YAxis dataKey="name" type="category" width={80} stroke="#87948d" tick={{fontSize: 11}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1d2026', borderColor: 'rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: '8px' }}
                    cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                  />
                  <Bar dataKey="fuelSaved" name="Fuel Saved (L)" fill="#67dab6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant/40">
                Loading chart...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ESGDashboard;
