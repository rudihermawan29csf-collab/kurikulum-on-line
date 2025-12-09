import React from 'react';
import { Ban, CheckCircle2, Save } from 'lucide-react';
import { TeacherData, CalendarEvent } from '../types';

interface HolidayManagerProps {
  teacherData: TeacherData[];
  constraints: Record<string, string[]>;
  onToggle: (code: string, day: string) => void;
  calendarEvents: CalendarEvent[];
  onUpdateCalendar: (events: CalendarEvent[]) => void;
  onSave?: () => void;
}

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUM'AT", "SABTU"];

const HolidayManager: React.FC<HolidayManagerProps> = ({ teacherData, constraints, onToggle, calendarEvents, onUpdateCalendar, onSave }) => {
  const [activeTab, setActiveTab] = React.useState<'SUBJECT' | 'CALENDAR'>('SUBJECT');
  
  // Calendar Form State
  const [calDate, setCalDate] = React.useState('');
  const [calDesc, setCalDesc] = React.useState('');

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (calDate && calDesc) {
      onUpdateCalendar([...calendarEvents, { id: Date.now().toString(), date: calDate, description: calDesc }]);
      setCalDate('');
      setCalDesc('');
    }
  };

  const handleDeleteEvent = (id: string) => {
    onUpdateCalendar(calendarEvents.filter(e => e.id !== id));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full animate-fade-in min-h-[600px]">
      
      {/* Tabs Header */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('SUBJECT')}
          className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors ${
             activeTab === 'SUBJECT' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          Libur Per Mapel
        </button>
        <button
          onClick={() => setActiveTab('CALENDAR')}
          className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors ${
             activeTab === 'CALENDAR' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          Kalender Libur Nasional
        </button>
      </div>

      {activeTab === 'SUBJECT' && (
        <>
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Ban className="text-red-500" />
                Atur Hari Libur / Tidak Bersedia Mengajar
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Centang hari dimana Guru/Mapel <strong>TIDAK BISA</strong> mengajar.
              </p>
            </div>
            {onSave && (
               <button 
                 onClick={onSave}
                 className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-sm"
               >
                  <Save size={18} /> Simpan Perubahan
               </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1 p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white sticky top-0 z-10 shadow-sm">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16 bg-gray-50 border-b border-gray-200">
                    Kode
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                    Nama Guru & Mapel
                  </th>
                  {DAYS.map(day => (
                    <th key={day} scope="col" className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 w-24">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teacherData.map((teacher, idx) => (
                  <tr key={`${teacher.id}-${teacher.code}`} className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                      {teacher.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                      <div className="text-xs text-gray-500">{teacher.subject}</div>
                    </td>
                    {DAYS.map(day => {
                      const isBlocked = constraints[teacher.code]?.includes(day);
                      return (
                        <td key={day} className="px-4 py-4 whitespace-nowrap text-center">
                          <label className="relative inline-flex items-center cursor-pointer group">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={isBlocked || false}
                              onChange={() => onToggle(teacher.code, day)}
                            />
                            <div className={`
                              w-12 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-200
                              ${isBlocked 
                                ? 'bg-red-50 border-red-500 text-red-600 shadow-inner' 
                                : 'bg-white border-gray-200 text-gray-300 hover:border-indigo-300'
                              }
                            `}>
                              {isBlocked ? <Ban size={18} /> : <CheckCircle2 size={18} className="opacity-0 group-hover:opacity-50" />}
                            </div>
                            {isBlocked && (
                              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-red-600 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Libur
                              </span>
                            )}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-800 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            Perubahan di sini akan mempengaruhi dropdown pilihan mapel saat mengisi jadwal.
          </div>
        </>
      )}

      {activeTab === 'CALENDAR' && (
         <div className="p-8 max-w-3xl mx-auto w-full">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
               <h3 className="text-lg font-bold text-blue-900 mb-4">Tambah Hari Libur Nasional / Cuti</h3>
               <form onSubmit={handleAddEvent} className="flex gap-4 items-end">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-blue-700 mb-1">Tanggal</label>
                     <input 
                        type="date" 
                        required
                        value={calDate}
                        onChange={(e) => setCalDate(e.target.value)}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                     />
                  </div>
                  <div className="flex-[2]">
                     <label className="block text-xs font-bold text-blue-700 mb-1">Keterangan Libur</label>
                     <input 
                        type="text" 
                        required
                        value={calDesc}
                        onChange={(e) => setCalDesc(e.target.value)}
                        placeholder="Contoh: Hari Raya Idul Fitri"
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                     />
                  </div>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm">
                     Tambah
                  </button>
               </form>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
               <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                     <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Tanggal</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Keterangan</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                     {calendarEvents.length > 0 ? (
                        calendarEvents.map(evt => (
                           <tr key={evt.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{evt.date}</td>
                              <td className="px-4 py-3 text-gray-700">{evt.description}</td>
                              <td className="px-4 py-3 text-center">
                                 <button 
                                    onClick={() => handleDeleteEvent(evt.id)}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                 >
                                    <Ban size={18} />
                                 </button>
                              </td>
                           </tr>
                        ))
                     ) : (
                        <tr>
                           <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                              Belum ada data hari libur.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
            
            {onSave && (
               <div className="mt-6 text-right">
                  <button 
                     onClick={onSave}
                     className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md"
                  >
                     <Save size={18} className="inline mr-2" /> Simpan Kalender
                  </button>
               </div>
            )}
         </div>
      )}
    </div>
  );
};

export default HolidayManager;