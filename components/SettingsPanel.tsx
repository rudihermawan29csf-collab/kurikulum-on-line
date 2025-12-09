import React, { useState, useMemo } from 'react';
import { Save, RefreshCw, Shield, Layout, Lock, Plus, Trash2, CalendarX, AlertCircle, Edit2, X, Filter, Calendar, Ban, Users, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { AppSettings, AuthSettings, TeacherData, TeacherLeave, LeaveType, SettingsPanelProps, CalendarEvent, Student } from '../types';
import { CLASSES } from '../constants';
import HolidayManager from './HolidayManager';
import * as XLSX from 'xlsx';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onSave, 
  authSettings, 
  onSaveAuth, 
  teacherData,
  teacherLeaves = [],
  onToggleLeave,
  onEditLeave,
  onDeleteLeave,
  calendarEvents = [],
  onUpdateCalendar,
  unavailableConstraints = {},
  onToggleConstraint,
  students = [],
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onBulkAddStudents
}) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'SECURITY' | 'LEAVE' | 'CALENDAR' | 'SUBJECT_HOLIDAY' | 'STUDENT'>('GENERAL');
  
  // General Settings State
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  // Auth Settings State
  const [authData, setAuthData] = useState<AuthSettings>(authSettings);
  const [isAuthSaved, setIsAuthSaved] = useState(false);

  // Leave Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterTeacherId, setFilterTeacherId] = useState<string>('');
  
  const [leaveForm, setLeaveForm] = useState<{
    date: string;
    teacherId: string;
    type: LeaveType;
    description: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    teacherId: '',
    type: 'SAKIT',
    description: ''
  });

  // Calendar State
  const [calDate, setCalDate] = useState('');
  const [calDesc, setCalDesc] = useState('');

  // Student Management State
  const [studentTabMode, setStudentTabMode] = useState<'MANUAL' | 'UPLOAD'>('MANUAL');
  const [studentForm, setStudentForm] = useState<{ name: string, className: string }>({ name: '', className: CLASSES[0] });
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentClassFilter, setStudentClassFilter] = useState<string>('');
  const [uploadClassTarget, setUploadClassTarget] = useState<string>(CLASSES[0]);
  const [isStudentSaved, setIsStudentSaved] = useState(false);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsSaved(false);
  };

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const setCurrentDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    setFormData(prev => ({ ...prev, lastUpdated: dateStr }));
    setIsSaved(false);
  };

  // --- Auth Handlers ---
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAuth(authData);
    setIsAuthSaved(true);
    setTimeout(() => setIsAuthSaved(false), 3000);
  };

  const handleTeacherPasswordChange = (name: string, pass: string) => {
    setAuthData(prev => ({
      ...prev,
      teacherPasswords: {
        ...prev.teacherPasswords,
        [name]: pass
      }
    }));
    setIsAuthSaved(false);
  };

  const handleClassPasswordChange = (cls: string, pass: string) => {
    setAuthData(prev => ({
      ...prev,
      classPasswords: {
        ...prev.classPasswords,
        [cls]: pass
      }
    }));
    setIsAuthSaved(false);
  };

  // --- Leave Handlers ---
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.teacherId) return;
    
    const teacher = teacherData.find(t => String(t.id) === leaveForm.teacherId);
    if (!teacher) return;

    if (editingId && onEditLeave) {
      // Update existing
      onEditLeave({
        id: editingId,
        date: leaveForm.date,
        teacherId: Number(leaveForm.teacherId),
        teacherName: teacher.name,
        type: leaveForm.type,
        description: leaveForm.description
      });
      setEditingId(null);
    } else if (onToggleLeave) {
      // Add new
      onToggleLeave({
        date: leaveForm.date,
        teacherId: teacher.id,
        teacherName: teacher.name,
        type: leaveForm.type,
        description: leaveForm.description
      });
    }

    setLeaveForm({ 
      date: new Date().toISOString().split('T')[0],
      teacherId: '',
      type: 'SAKIT',
      description: ''
    });
  };

  const handleEditClick = (leave: TeacherLeave) => {
    setLeaveForm({
      date: leave.date,
      teacherId: String(leave.teacherId),
      type: leave.type,
      description: leave.description || ''
    });
    setEditingId(leave.id);
    const formElement = document.getElementById('leave-form-anchor');
    if(formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setLeaveForm({ 
      date: new Date().toISOString().split('T')[0],
      teacherId: '',
      type: 'SAKIT',
      description: ''
    });
  };

  // --- Calendar Handlers ---
  const getDayName = (dateStr: string) => {
    if (!dateStr) return '';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const handleAddCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (calDate && calDesc && onUpdateCalendar) {
      onUpdateCalendar([...calendarEvents, { id: Date.now().toString(), date: calDate, description: calDesc }]);
      setCalDate('');
      setCalDesc('');
    }
  };

  const handleDeleteCalendarEvent = (id: string) => {
    if (onUpdateCalendar) {
      onUpdateCalendar(calendarEvents.filter(e => e.id !== id));
    }
  };

  // --- Student Handlers ---
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.className) return;

    const studentData: Student = {
      id: editingStudentId || Date.now().toString(),
      name: studentForm.name,
      className: studentForm.className
    };

    if (editingStudentId && onEditStudent) {
      onEditStudent(studentData);
      setEditingStudentId(null);
    } else if (onAddStudent) {
      onAddStudent(studentData);
    }

    setStudentForm({ name: '', className: CLASSES[0] });
  };

  const startEditStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setStudentForm({ name: student.name, className: student.className });
    setStudentTabMode('MANUAL');
  };

  const downloadStudentTemplate = () => {
    const header = ["No", "Kelas", "Nama Siswa"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format Siswa");
    XLSX.writeFile(wb, "Format_Input_Siswa.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string') return;
      
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Assuming format: No, Kelas, Nama Siswa (Index 0, 1, 2)
      // Skip header row
      const newStudents: Student[] = [];
      data.slice(1).forEach((row: any) => {
        if (row[2]) { // If name exists
          newStudents.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: String(row[2]),
            className: row[1] ? String(row[1]) : uploadClassTarget // Use Excel class if present, else dropdown selection
          });
        }
      });

      if (onBulkAddStudents && newStudents.length > 0) {
        onBulkAddStudents(newStudents);
        alert(`Berhasil mengupload ${newStudents.length} siswa.`);
      } else {
        alert("Tidak ada data siswa yang valid ditemukan.");
      }
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleStudentSaveTrigger = () => {
    // This function serves as visual confirmation since data is auto-persisted in App.tsx
    setIsStudentSaved(true);
    setTimeout(() => setIsStudentSaved(false), 3000);
  };

  // Unique Teacher Names
  const uniqueTeachers = Array.from(new Set(teacherData.map(t => t.name))).sort();

  // Filtered Leaves
  const filteredLeaves = useMemo((): TeacherLeave[] => {
    if (!filterTeacherId) return teacherLeaves;
    return teacherLeaves.filter(l => String(l.teacherId) === filterTeacherId);
  }, [teacherLeaves, filterTeacherId]);

  // Statistics
  const leaveStats = useMemo(() => {
    const stats: Record<string, number> = { SAKIT: 0, IZIN: 0, DINAS_LUAR: 0, TOTAL: 0 };
    filteredLeaves.forEach(l => {
      if (stats[l.type] !== undefined) {
        stats[l.type]++;
      }
      stats.TOTAL++;
    });
    return stats;
  }, [filteredLeaves]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!studentClassFilter) return students;
    return students.filter(s => s.className === studentClassFilter);
  }, [students, studentClassFilter]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-2">Pengaturan</h2>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('GENERAL')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'GENERAL' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Layout size={18} />
              Umum
            </button>
            <button
              onClick={() => setActiveTab('SECURITY')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'SECURITY' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Shield size={18} />
              Manajemen Akun
            </button>
            <button
              onClick={() => setActiveTab('LEAVE')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'LEAVE' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <CalendarX size={18} />
              Perizinan Guru
            </button>
            <button
              onClick={() => setActiveTab('CALENDAR')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'CALENDAR' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar size={18} />
              Kalender Libur
            </button>
            <button
              onClick={() => setActiveTab('SUBJECT_HOLIDAY')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'SUBJECT_HOLIDAY' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Ban size={18} />
              Libur Per Mapel
            </button>
            <button
              onClick={() => setActiveTab('STUDENT')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'STUDENT' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users size={18} />
              Manajemen Siswa
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[800px]">
          
          {/* --- GENERAL TAB --- */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Informasi Aplikasi</h2>
                <p className="text-sm text-gray-500 mt-1">Ubah header dan periode akademik.</p>
              </div>
              
              <form onSubmit={handleGeneralSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">URL Logo Sekolah</label>
                    <input
                      type="text"
                      name="logoUrl"
                      value={formData.logoUrl || ''}
                      onChange={handleGeneralChange}
                      placeholder="https://example.com/logo.png"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Masukkan link langsung ke gambar (akhiran .png, .jpg). Jika kosong atau rusak, logo default akan muncul.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tahun Ajaran</label>
                    <input
                      type="text"
                      name="academicYear"
                      value={formData.academicYear}
                      onChange={handleGeneralChange}
                      placeholder="Contoh: 2025/2026"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Semester</label>
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleGeneralChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Update Terakhir</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="lastUpdated"
                        value={formData.lastUpdated}
                        onChange={handleGeneralChange}
                        placeholder="Contoh: 25 Februari 2025"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={setCurrentDate}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 font-medium"
                      >
                        <RefreshCw size={18} /> Hari Ini
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
                  {isSaved && <span className="text-green-600 font-medium text-sm">Disimpan!</span>}
                  <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md">
                    <Save size={18} className="inline mr-2" /> Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* --- SECURITY TAB --- */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Manajemen Akun & Keamanan</h2>
                <p className="text-sm text-gray-500 mt-1">Atur password untuk Admin, Guru, dan Ketua Kelas.</p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-8">
                
                {/* 1. Admin Password */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <Lock size={16} className="text-red-500" /> Password Admin
                  </h3>
                  <div>
                    <input 
                      type="text" 
                      value={authData.adminPassword || '007007Rh'} // Show default if empty
                      onChange={(e) => {
                        setAuthData({...authData, adminPassword: e.target.value});
                        setIsAuthSaved(false);
                      }}
                      className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="Masukkan password admin baru"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: 007007Rh</p>
                  </div>
                </div>

                {/* 2. Teacher Passwords */}
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <Lock size={16} className="text-emerald-500" /> Password Guru
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left font-bold text-gray-600">Nama Guru</th>
                            <th className="px-4 py-2 text-left font-bold text-gray-600">Password</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {uniqueTeachers.map((name, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-gray-800 font-medium">{name}</td>
                              <td className="px-4 py-2">
                                <input 
                                  type="text" 
                                  value={authData.teacherPasswords[name] || ''}
                                  onChange={(e) => handleTeacherPasswordChange(name, e.target.value)}
                                  placeholder="Belum diatur"
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:border-emerald-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 3. Class Passwords */}
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <Lock size={16} className="text-orange-500" /> Password Ketua Kelas
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left font-bold text-gray-600">Kelas</th>
                            <th className="px-4 py-2 text-left font-bold text-gray-600">Password</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {CLASSES.map((cls) => (
                            <tr key={cls}>
                              <td className="px-4 py-2 text-gray-800 font-medium">{cls}</td>
                              <td className="px-4 py-2">
                                <input 
                                  type="text" 
                                  value={authData.classPasswords[cls] || ''}
                                  onChange={(e) => handleClassPasswordChange(cls, e.target.value)}
                                  placeholder="Belum diatur"
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:border-orange-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4 sticky bottom-0 bg-white py-2">
                  {isAuthSaved && <span className="text-green-600 font-medium text-sm">Akun Disimpan!</span>}
                  <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md">
                    <Save size={18} className="inline mr-2" /> Simpan Akun
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* --- TEACHER LEAVE TAB --- */}
          {activeTab === 'LEAVE' && onToggleLeave && onDeleteLeave && (
            <div className="space-y-8 animate-fade-in" id="leave-form-anchor">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Perizinan Guru</h2>
                <p className="text-sm text-gray-500 mt-1">Catat guru yang berhalangan hadir (Sakit, Izin, Dinas Luar).</p>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col items-center">
                    <span className="text-red-500 text-xs font-bold uppercase mb-1">Sakit</span>
                    <span className="text-2xl font-bold text-red-700">{leaveStats.SAKIT}</span>
                 </div>
                 <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex flex-col items-center">
                    <span className="text-yellow-600 text-xs font-bold uppercase mb-1">Izin</span>
                    <span className="text-2xl font-bold text-yellow-700">{leaveStats.IZIN}</span>
                 </div>
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center">
                    <span className="text-blue-500 text-xs font-bold uppercase mb-1">Dinas Luar</span>
                    <span className="text-2xl font-bold text-blue-700">{leaveStats.DINAS_LUAR}</span>
                 </div>
                 <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 flex flex-col items-center">
                    <span className="text-gray-500 text-xs font-bold uppercase mb-1">Total</span>
                    <span className="text-2xl font-bold text-gray-700">{leaveStats.TOTAL}</span>
                 </div>
              </div>

              {/* Form Input */}
              <div className={`p-4 rounded-xl border transition-colors ${editingId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-100'}`}>
                <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${editingId ? 'text-orange-800' : 'text-blue-800'}`}>
                  {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                  {editingId ? 'Edit Izin' : 'Tambah Izin Baru'}
                </h3>
                <form onSubmit={handleSubmitLeave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label>
                     <input 
                       type="date"
                       required
                       value={leaveForm.date}
                       onChange={(e) => setLeaveForm({...leaveForm, date: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-gray-600 mb-1">Nama Guru</label>
                     <select
                       required
                       value={leaveForm.teacherId}
                       onChange={(e) => setLeaveForm({...leaveForm, teacherId: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                     >
                       <option value="">-- Pilih Guru --</option>
                       {teacherData.map((t: TeacherData) => (
                         <option key={t.id} value={t.id}>{t.name}</option>
                       ))}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-gray-600 mb-1">Jenis Izin</label>
                     <select
                       value={leaveForm.type}
                       onChange={(e) => setLeaveForm({...leaveForm, type: e.target.value as LeaveType})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                     >
                       <option value="SAKIT">Sakit</option>
                       <option value="IZIN">Izin</option>
                       <option value="DINAS_LUAR">Dinas Luar</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-gray-600 mb-1">Keterangan (Opsional)</label>
                     <input 
                       type="text"
                       value={leaveForm.description}
                       onChange={(e) => setLeaveForm({...leaveForm, description: e.target.value})}
                       placeholder="Contoh: Rapat MKKS"
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                     />
                   </div>
                   <div className="md:col-span-2 flex justify-end gap-2">
                     {editingId && (
                       <button 
                         type="button" 
                         onClick={cancelEdit}
                         className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300"
                       >
                         Batal
                       </button>
                     )}
                     <button 
                       type="submit" 
                       className={`px-4 py-2 text-white rounded-lg text-sm font-bold ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                     >
                       {editingId ? 'Update Izin' : 'Simpan Izin'}
                     </button>
                   </div>
                </form>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-200">
                 <Filter size={18} className="text-gray-400" />
                 <select 
                    value={filterTeacherId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterTeacherId(e.target.value)}
                    className="flex-1 border-none bg-transparent text-sm font-semibold text-gray-700 focus:ring-0 cursor-pointer"
                 >
                    <option value="">-- Tampilkan Semua Guru --</option>
                    {teacherData.map((t: TeacherData) => (
                       <option key={t.id} value={`${t.id}`}>{t.name}</option>
                    ))}
                 </select>
                 {filterTeacherId && (
                    <button onClick={() => setFilterTeacherId('')} className="p-1 hover:bg-gray-100 rounded-full">
                       <X size={16} className="text-gray-500" />
                    </button>
                 )}
              </div>

              {/* List */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-4 py-3 text-left font-bold text-gray-600">Tanggal</th>
                       <th className="px-4 py-3 text-left font-bold text-gray-600">Guru</th>
                       <th className="px-4 py-3 text-center font-bold text-gray-600">Jenis</th>
                       <th className="px-4 py-3 text-left font-bold text-gray-600">Keterangan</th>
                       <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                     {filteredLeaves.length > 0 ? (
                       filteredLeaves.map((leave: TeacherLeave) => (
                         <tr key={leave.id} className="hover:bg-gray-50">
                           <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{leave.date}</td>
                           <td className="px-4 py-3 font-medium text-gray-800">{leave.teacherName}</td>
                           <td className="px-4 py-3 text-center">
                             <span className={`inline-block px-2 py-1 rounded text-xs font-bold 
                               ${leave.type === 'SAKIT' ? 'bg-red-100 text-red-700' : 
                                 leave.type === 'IZIN' ? 'bg-yellow-100 text-yellow-700' : 
                                 'bg-blue-100 text-blue-700'}`}>
                               {leave.type.replace('_', ' ')}
                             </span>
                           </td>
                           <td className="px-4 py-3 text-gray-600 italic">{leave.description || '-'}</td>
                           <td className="px-4 py-3 text-center">
                             <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditClick(leave)}
                                  className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => onDeleteLeave(leave.id)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 size={16} />
                                </button>
                             </div>
                           </td>
                         </tr>
                       ))
                     ) : (
                       <tr>
                         <td colSpan={5} className="px-4 py-8 text-center text-gray-500 flex flex-col items-center justify-center">
                           <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                           {filterTeacherId ? "Tidak ada izin untuk guru ini." : "Belum ada data izin guru."}
                         </td>
                       </tr>
                     )}
                   </tbody>
                </table>
              </div>

            </div>
          )}

          {/* --- CALENDAR HOLIDAY TAB --- */}
          {activeTab === 'CALENDAR' && onUpdateCalendar && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Kalender Libur</h2>
                <p className="text-sm text-gray-500 mt-1">Atur hari libur nasional atau cuti bersama.</p>
              </div>

              <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
                  <Plus size={20} /> Tambah Libur Baru
                </h3>
                <form onSubmit={handleAddCalendarEvent} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-purple-700 mb-1">Tanggal</label>
                    <input 
                      type="date" 
                      required
                      value={calDate}
                      onChange={(e) => setCalDate(e.target.value)}
                      className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-purple-700 mb-1">Hari</label>
                    <div className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm text-gray-500 font-medium h-[38px] flex items-center">
                      {getDayName(calDate) || '-'}
                    </div>
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-xs font-bold text-purple-700 mb-1">Keterangan Libur</label>
                    <input 
                      type="text" 
                      required
                      value={calDesc}
                      onChange={(e) => setCalDesc(e.target.value)}
                      placeholder="Contoh: Hari Raya Idul Fitri"
                      className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-sm transition-colors">
                      Tambah
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-600">Tanggal</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600">Hari</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600">Keterangan</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {calendarEvents.length > 0 ? (
                      calendarEvents.map(evt => (
                        <tr key={evt.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{evt.date}</td>
                          <td className="px-4 py-3 text-gray-600">{getDayName(evt.date)}</td>
                          <td className="px-4 py-3 text-gray-700">{evt.description}</td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => handleDeleteCalendarEvent(evt.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          Belum ada data hari libur. Silahkan tambahkan di atas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

           {/* --- SUBJECT HOLIDAY TAB --- */}
           {activeTab === 'SUBJECT_HOLIDAY' && onToggleConstraint && (
              <HolidayManager 
                teacherData={teacherData} 
                constraints={unavailableConstraints} 
                onToggle={onToggleConstraint}
                calendarEvents={calendarEvents}
                onUpdateCalendar={onUpdateCalendar || (() => {})} 
                // We don't pass onSave here because saving is handled via App state propagation or implicit saves
              />
           )}

           {/* --- STUDENT TAB --- */}
           {activeTab === 'STUDENT' && (
             <div className="space-y-6 animate-fade-in">
               <div className="border-b border-gray-200 pb-4">
                 <h2 className="text-xl font-bold text-gray-800">Manajemen Siswa</h2>
                 <p className="text-sm text-gray-500 mt-1">Input data siswa secara manual atau upload Excel.</p>
               </div>

               {/* Sub Tabs */}
               <div className="flex gap-4 border-b border-gray-200">
                  <button 
                    onClick={() => setStudentTabMode('MANUAL')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors ${studentTabMode === 'MANUAL' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Input Data Manual
                  </button>
                  <button 
                    onClick={() => setStudentTabMode('UPLOAD')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors ${studentTabMode === 'UPLOAD' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Upload Data (Excel)
                  </button>
               </div>

               {/* MANUAL INPUT FORM */}
               {studentTabMode === 'MANUAL' && (
                 <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                    <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                       {editingStudentId ? <Edit2 size={20} /> : <Plus size={20} />} 
                       {editingStudentId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
                    </h3>
                    <form onSubmit={handleStudentSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                       <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-indigo-700 mb-1">Kelas</label>
                          <select 
                             required
                             value={studentForm.className}
                             onChange={(e) => setStudentForm({...studentForm, className: e.target.value})}
                             className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                          >
                             {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                       </div>
                       <div className="md:col-span-7">
                          <label className="block text-xs font-bold text-indigo-700 mb-1">Nama Siswa</label>
                          <input 
                             type="text"
                             required
                             value={studentForm.name}
                             onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                             className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                             placeholder="Nama Lengkap Siswa"
                          />
                       </div>
                       <div className="md:col-span-2 flex gap-2">
                          {editingStudentId && (
                             <button 
                               type="button" 
                               onClick={() => { setEditingStudentId(null); setStudentForm({name:'', className: CLASSES[0]}); }}
                               className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                             >
                                Batal
                             </button>
                          )}
                          <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-colors">
                             {editingStudentId ? 'Update' : 'Simpan'}
                          </button>
                       </div>
                    </form>
                    
                    {/* Manual Save Button Footer */}
                    <div className="mt-6 pt-4 border-t border-indigo-200 flex justify-end items-center gap-3">
                       {isStudentSaved && <span className="text-green-600 font-bold text-sm animate-fade-in">Data Berhasil Disimpan!</span>}
                       <button 
                          type="button"
                          onClick={handleStudentSaveTrigger}
                          className="px-6 py-2 bg-indigo-700 text-white rounded-lg font-bold hover:bg-indigo-800 shadow-md transition-all active:scale-95"
                       >
                          Simpan Perubahan
                       </button>
                    </div>
                 </div>
               )}

               {/* UPLOAD EXCEL FORM */}
               {studentTabMode === 'UPLOAD' && (
                  <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                     <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                        <Upload size={20} /> Upload Data Siswa via Excel
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                           <p className="text-sm text-green-800 mb-2 font-semibold">Langkah 1: Download Format</p>
                           <button 
                              onClick={downloadStudentTemplate}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors shadow-sm font-medium text-sm w-full justify-center"
                           >
                              <FileSpreadsheet size={18} /> Download Template Excel
                           </button>
                           <p className="text-xs text-green-600 mt-2">
                              Format kolom: No, Kelas, Nama Siswa.
                           </p>
                        </div>
                        <div>
                           <p className="text-sm text-green-800 mb-2 font-semibold">Langkah 2: Upload Data</p>
                           <div className="space-y-3">
                              <div>
                                 <label className="block text-xs font-bold text-green-700 mb-1">Pilih Kelas Target</label>
                                 <select 
                                    value={uploadClassTarget}
                                    onChange={(e) => setUploadClassTarget(e.target.value)}
                                    className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                                 >
                                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                              </div>
                              <input 
                                 type="file" 
                                 accept=".xlsx, .xls"
                                 onChange={handleFileUpload}
                                 className="block w-full text-sm text-green-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200"
                              />
                           </div>
                        </div>
                     </div>
                     
                     {/* Upload Save Button Footer */}
                     <div className="mt-8 pt-4 border-t border-green-200 flex justify-end items-center gap-3">
                        {isStudentSaved && <span className="text-green-600 font-bold text-sm animate-fade-in">Data Berhasil Disimpan!</span>}
                        <button 
                           type="button"
                           onClick={handleStudentSaveTrigger}
                           className="px-6 py-2 bg-green-700 text-white rounded-lg font-bold hover:bg-green-800 shadow-md transition-all active:scale-95"
                        >
                           Simpan Perubahan
                        </button>
                     </div>
                  </div>
               )}

               {/* STUDENT LIST TABLE */}
               <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Table Toolbar */}
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                     <h4 className="font-bold text-gray-700 text-sm">Daftar Siswa</h4>
                     <div className="flex items-center gap-2">
                        <Filter size={14} className="text-gray-400" />
                        <select 
                           value={studentClassFilter}
                           onChange={(e) => setStudentClassFilter(e.target.value)}
                           className="text-sm border-none bg-transparent font-semibold text-gray-600 focus:ring-0 cursor-pointer"
                        >
                           <option value="">Semua Kelas</option>
                           {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                  </div>
                  
                  <div className="overflow-x-auto max-h-[400px]">
                     <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                           <tr>
                              <th className="px-4 py-3 text-left font-bold text-gray-600 w-16">No</th>
                              <th className="px-4 py-3 text-left font-bold text-gray-600 w-24">Kelas</th>
                              <th className="px-4 py-3 text-left font-bold text-gray-600">Nama Siswa</th>
                              <th className="px-4 py-3 text-center font-bold text-gray-600 w-24">Aksi</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                           {filteredStudents.length > 0 ? (
                              filteredStudents.map((student, idx) => (
                                 <tr key={student.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500 text-center">{idx + 1}</td>
                                    <td className="px-4 py-2">
                                       <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold border border-gray-200">
                                          {student.className}
                                       </span>
                                    </td>
                                    <td className="px-4 py-2 font-medium text-gray-800">{student.name}</td>
                                    <td className="px-4 py-2 text-center">
                                       <div className="flex items-center justify-center gap-2">
                                          <button 
                                             onClick={() => startEditStudent(student)}
                                             className="text-blue-500 hover:bg-blue-50 p-1 rounded"
                                             title="Edit"
                                          >
                                             <Edit2 size={16} />
                                          </button>
                                          <button 
                                             onClick={() => onDeleteStudent && onDeleteStudent(student.id)}
                                             className="text-red-500 hover:bg-red-50 p-1 rounded"
                                             title="Hapus"
                                          >
                                             <Trash2 size={16} />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              ))
                           ) : (
                              <tr>
                                 <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                    Tidak ada data siswa.
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 text-right">
                     Total Siswa: {filteredStudents.length}
                  </div>
               </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;