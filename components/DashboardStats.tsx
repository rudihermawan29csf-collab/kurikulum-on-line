import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TEACHER_DATA } from '../constants';

const DashboardStats: React.FC = () => {
  // Aggregate data for chart (combine rows with same name)
  const chartData = Object.values(TEACHER_DATA.reduce((acc, curr) => {
    if (!acc[curr.name]) {
      acc[curr.name] = { name: curr.name.split(',')[0], totalHours: 0, subject: curr.subject };
    }
    // Only take the max total hours if duplicates exist (since the total column in data usually accounts for all)
    // Or sum them? In this specific dataset, the "Total" is per row.
    // Let's sum if the names match to show true workload.
    // HOWEVER, for rows 12, 14, 16, 17 the data provided splits the subjects but might duplicate the "Total" logic or split it.
    // Looking at the data (e.g. #12), row 1 is 22, row 2 is 6. True total is 28.
    acc[curr.name].totalHours += curr.totalHours;
    return acc;
  }, {} as Record<string, { name: string; totalHours: number, subject: string }>));

  // Sort by hours
  chartData.sort((a, b) => b.totalHours - a.totalHours);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Total Jam Mengajar per Guru</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 11}} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{fill: '#f1f5f9'}}
              />
              <Bar dataKey="totalHours" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.totalHours > 24 ? '#4f46e5' : '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">* Biru: &gt; 24 Jam (Beban Kerja Penuh)</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center items-center text-center">
        <h3 className="text-lg font-bold text-gray-800 mb-6">Ringkasan Statistik</h3>
        <div className="grid grid-cols-2 gap-4 w-full">
           <div className="p-4 bg-indigo-50 rounded-lg">
             <div className="text-3xl font-bold text-indigo-600">{chartData.length}</div>
             <div className="text-sm text-indigo-800 font-medium">Total Guru</div>
           </div>
           <div className="p-4 bg-emerald-50 rounded-lg">
             <div className="text-3xl font-bold text-emerald-600">
               {chartData.reduce((sum, t) => sum + t.totalHours, 0)}
             </div>
             <div className="text-sm text-emerald-800 font-medium">Total Jam Pelajaran</div>
           </div>
           <div className="p-4 bg-orange-50 rounded-lg">
             <div className="text-3xl font-bold text-orange-600">
               {chartData.filter(t => t.totalHours >= 24).length}
             </div>
             <div className="text-sm text-orange-800 font-medium">Guru (≥24 Jam)</div>
           </div>
           <div className="p-4 bg-rose-50 rounded-lg">
             <div className="text-3xl font-bold text-rose-600">
               {(chartData.reduce((sum, t) => sum + t.totalHours, 0) / chartData.length).toFixed(1)}
             </div>
             <div className="text-sm text-rose-800 font-medium">Rata-rata Jam</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;