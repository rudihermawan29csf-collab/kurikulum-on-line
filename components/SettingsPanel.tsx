import React, { useState, useMemo } from 'react';
import { Save, RefreshCw, Shield, Layout, Lock, Plus, Trash2, CalendarX, AlertCircle, Edit2, X, Filter, Calendar, Ban, Users, Upload, FileSpreadsheet, CheckCircle2, Download } from 'lucide-react';
import { AppSettings, AuthSettings, TeacherData, TeacherLeave, LeaveType, SettingsPanelProps, Student } from '../types';
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
  const [isCalendarSaved, setIsCalendarSaved] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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
      if (editingEventId) {
        // Update
        const updatedEvents = calendarEvents.map(evt => 
          evt.id === editingEventId ? { ...evt, date: calDate, description: calDesc } : evt
        );
        onUpdateCalendar(updatedEvents);
        setEditingEventId(null);
      } else {
        // Add
        onUpdateCalendar([...calendarEvents, { id: Date.now().toString(), date: calDate, description: calDesc }]);
      }
      setCalDate('');
      setCalDesc('');
    }
  };

  const handleEditCalendarEvent = (id: string) => {
    const evt = calendarEvents.find(e => e.id === id);
    if (evt) {
      setCalDate(evt.date);
      setCalDesc(evt.description);
      setEditingEventId(id);
    }
  };

  const handleDeleteCalendarEvent = (id: string) => {
    if (onUpdateCalendar) {
      onUpdateCalendar(calendarEvents.filter(e => e.id !== id));
    }
  };

  const handleCalendarSaveTrigger = () => {
    setIsCalendarSaved(true);
    setTimeout(() => setIsCalendarSaved(false), 3000);
  };

  const handleSubjectHolidaySave = () => {
    alert("Pengaturan Libur Mapel berhasil disimpan!");
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
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

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
  const uniqueTeachers = Array.from(new Set(teacherData.map(t => t.name))).sort() as string[];

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
                <p className="text-sm text-gray-500 mt-1">Ubah header, periode akademik, dan data sekolah.</p>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Kepala Sekolah</label>
                      <input
                        type="text"
                        name="headmaster"
                        value={formData.headmaster || ''}
                        onChange={handleGeneralChange}
                        placeholder="Contoh: Drs. Budi Santoso, M.Pd"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">NIP Kepala Sekolah</label>
                      <input
                        type="text"
                        name="headmasterNip"
                        value={formData.headmasterNip || ''}
                        onChange={handleGeneralChange}
                        placeholder="Contoh: 196501011990031002"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
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
                  {isSaved && <span className="text-green-600 font-medium text-sm animate-pulse">Disimpan!</span>}
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
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-indigo-600" /> Password Admin
                  </h3>
                  <div className="max-w-md">
                    <input 
                      type="text" 
                      value={authData.adminPassword || ''}
                      onChange={(e) => {
                         setAuthData(prev => ({ ...prev, adminPassword: e.target.value }));
                         setIsAuthSaved(false);
                      }}
                      placeholder="Masukkan password admin baru..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-2">Kosongkan untuk menggunakan default (007007Rh).</p>
                  </div>
                </div>

                {/* 2. Teacher Passwords */}
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-emerald-600" /> Password Guru
                  </h3>
                  <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                     {uniqueTeachers.map(teacherName => (
                       <div key={teacherName} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-gray-100">
                          <span className="text-sm font-medium text-gray-700">{teacherName}</span>
                          <input 
                            type="text" 
                            value={authData.teacherPasswords[teacherName] || ''}
                            onChange={(e) => handleTeacherPasswordChange(teacherName, e.target.value)}
                            placeholder="Password..."
                            className="w-40 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                          />
                       </div>
                     ))}
                  </div>
                </div>

                {/* 3. Class Passwords */}
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-orange-600" /> Password Kelas (Siswa)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                     {CLASSES.map(cls => (
                       <div key={cls} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-gray-100">
                          <span className="text-sm font-medium text-gray-700">{cls}</span>
                          <input 
                            type="text" 
                            value={authData.classPasswords[cls] || ''}
                            onChange={(e) => handleClassPasswordChange(cls, e.target.value)}
                            placeholder="Password..."
                            className="w-40 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-orange-500"
                          />
                       </div>
                     ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4 sticky bottom-0 bg-white p-4 shadow-up">
                  {isAuthSaved && <span className="text-green-600 font-medium text-sm animate-pulse">Disimpan!</span>}
                  <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md">
                    <Save size={18} className="inline mr-2" /> Simpan Konfigurasi Akun
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* --- LEAVE TAB --- */}
          {activeTab === 'LEAVE' && (
            <div className="space-y-6 animate-fade-in">
              <div id="leave-form-anchor" className="border-b border-gray-200 pb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Perizinan Guru</h2>
                  <p className="text-sm text-gray-500 mt-1">Catat guru yang berhalangan hadir.</p>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="text-xs font-bold text-blue-600 uppercase">Total Izin</h3>
                    <p className="text-2xl font-bold text-blue-800">{leaveStats.TOTAL}</p>
                 </div>
                 <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h3 className="text-xs font-bold text-red-600 uppercase">Sakit</h3>
                    <p className="text-2xl font-bold text-red-800">{leaveStats.SAKIT}</p>
                 </div>
                 <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <h3 className="text-xs font-bold text-orange-600 uppercase">Izin</h3>
                    <p className="text-2xl font-bold text-orange-800">{leaveStats.IZIN}</p>
                 </div>
                 <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h3 className="text-xs font-bold text-purple-600 uppercase">Dinas Luar</h3>
                    <p className="text-2xl font-bold text-purple-800">{leaveStats.DINAS_LUAR}</p>
                 </div>
              </div>

              {/* Form */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <form onSubmit={handleSubmitLeave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal</label>
                    <input 
                      type="date" 
                      required
                      value={leaveForm.date}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Guru</label>
                    <select
                      required
                      value={leaveForm.teacherId}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, teacherId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teacherData.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Izin</label>
                    <div className="flex gap-4 mt-2">
                       {['SAKIT', 'IZIN', 'DINAS_LUAR'].map(type => (
                         <label key={type} className="flex items-center gap-2 cursor-pointer">
                           <input 
                             type="radio" 
                             name="leaveType"
                             checked={leaveForm.type === type}
                             onChange={() => setLeaveForm(prev => ({ ...prev, type: type as LeaveType }))}
                             className="text-indigo-600 focus:ring-indigo-500"
                           />
                           <span className="text-sm font-medium text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                         </label>
                       ))}
                    </div>
                  </div>
                  <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                     <input 
                       type="text"
                       value={leaveForm.description}
                       onChange={(e) => setLeaveForm(prev => ({ ...prev, description: e.target.value }))}
                       placeholder="Contoh: Demam tinggi / Rapat di Dinas"
                       className="w-full border border-gray-300 rounded-lg px-3 py-2"
                     />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2">
                     {editingId && (
                        <button 
                           type="button" 
                           onClick={cancelEdit}
                           className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                        >
                           Batal
                        </button>
                     )}
                     <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm">
                        {editingId ? 'Simpan Perubahan' : 'Tambah Data Izin'}
                     </button>
                  </div>
                </form>
              </div>

              {/* List */}
              <div>
                <div className="flex justify-between items-end mb-2">
                   <h3 className="text-lg font-bold text-gray-800">Riwayat Perizinan</h3>
                   <div className="flex items-center gap-2">
                      <Filter size={16} className="text-gray-400" />
                      <select 
                        value={filterTeacherId}
                        onChange={(e) => setFilterTeacherId(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                      >
                         <option value="">Semua Guru</option>
                         {uniqueTeachers.map(name => {
                            const t = teacherData.find(td => td.name === name);
                            return t ? <option key={t.id} value={String(t.id)}>{name}</option> : null;
                         })}
                      </select>
                   </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                   <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                         <tr>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Tanggal</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Nama Guru</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600">Jenis</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Keterangan</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                         {filteredLeaves.length > 0 ? filteredLeaves.map(leave => (
                            <tr key={leave.id} className="hover:bg-gray-50">
                               <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{leave.date}</td>
                               <td className="px-4 py-3 text-gray-700">{leave.teacherName}</td>
                               <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-bold 
                                    ${leave.type === 'SAKIT' ? 'bg-red-100 text-red-700' : 
                                      leave.type === 'IZIN' ? 'bg-orange-100 text-orange-700' : 
                                      'bg-purple-100 text-purple-700'}`}>
                                     {leave.type.replace('_', ' ')}
                                  </span>
                               </td>
                               <td className="px-4 py-3 text-gray-600">{leave.description || '-'}</td>
                               <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                     {onEditLeave && (
                                       <button 
                                         onClick={() => handleEditClick(leave)} 
                                         className="text-blue-500 hover:bg-blue-50 p-1 rounded"
                                         title="Edit"
                                       >
                                          <Edit2 size={16} />
                                       </button>
                                     )}
                                     {onDeleteLeave && (
                                       <button 
                                         onClick={() => onDeleteLeave(leave.id)} 
                                         className="text-red-500 hover:bg-red-50 p-1 rounded"
                                         title="Hapus"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                     )}
                                  </div>
                               </td>
                            </tr>
                         )) : (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada data izin.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>
          )}

          {/* --- CALENDAR TAB --- */}
          {activeTab === 'CALENDAR' && (
             <div className="space-y-6 animate-fade-in">
                <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-xl font-bold text-gray-800">Kalender Libur Nasional</h2>
                  <p className="text-sm text-gray-500 mt-1">Atur tanggal merah agar tidak bisa diisi jadwal/absen.</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                   <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <Plus size={20} /> {editingEventId ? 'Edit Hari Libur' : 'Tambah Hari Libur'}
                   </h3>
                   <form onSubmit={handleAddCalendarEvent} className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 w-full">
                         <label className="block text-xs font-bold text-blue-700 mb-1">Tanggal</label>
                         <input 
                            type="date" 
                            required
                            value={calDate}
                            onChange={(e) => setCalDate(e.target.value)}
                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div className="w-full md:w-32">
                         <label className="block text-xs font-bold text-blue-700 mb-1">Hari</label>
                         <input 
                            type="text" 
                            readOnly
                            value={getDayName(calDate)}
                            className="w-full bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 text-sm font-semibold text-blue-800"
                            placeholder="-"
                         />
                      </div>
                      <div className="flex-[2] w-full">
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
                      <div className="flex gap-2 w-full md:w-auto">
                         {editingEventId && (
                            <button 
                               type="button" 
                               onClick={() => { setEditingEventId(null); setCalDate(''); setCalDesc(''); }} 
                               className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                            >
                               Batal
                            </button>
                         )}
                         <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm flex-1 md:flex-none">
                            {editingEventId ? 'Simpan' : 'Tambah'}
                         </button>
                      </div>
                   </form>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
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
                                  <td className="px-4 py-3 font-medium text-gray-900">{evt.date}</td>
                                  <td className="px-4 py-3 text-gray-600">{getDayName(evt.date)}</td>
                                  <td className="px-4 py-3 text-gray-700">{evt.description}</td>
                                  <td className="px-4 py-3 text-center">
                                     <div className="flex items-center justify-center gap-2">
                                        <button 
                                           onClick={() => handleEditCalendarEvent(evt.id)}
                                           className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded"
                                        >
                                           <Edit2 size={16} />
                                        </button>
                                        <button 
                                           onClick={() => handleDeleteCalendarEvent(evt.id)}
                                           className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
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
                                  Belum ada data hari libur.
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>

                <div className="mt-6 text-right sticky bottom-0 bg-white p-4 border-t border-gray-100">
                   {isCalendarSaved && <span className="text-green-600 font-medium text-sm animate-pulse mr-4">Disimpan!</span>}
                   <button 
                      onClick={handleCalendarSaveTrigger}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md"
                   >
                      <Save size={18} className="inline mr-2" /> Simpan Kalender
                   </button>
                </div>
             </div>
          )}

          {/* --- SUBJECT HOLIDAY TAB --- */}
          {activeTab === 'SUBJECT_HOLIDAY' && (
             <HolidayManager 
                teacherData={teacherData}
                constraints={unavailableConstraints}
                onToggle={onToggleConstraint || (() => {})}
                calendarEvents={calendarEvents}
                onUpdateCalendar={onUpdateCalendar || (() => {})}
                onSave={handleSubjectHolidaySave}
             />
          )}

          {/* --- STUDENT TAB --- */}
          {activeTab === 'STUDENT' && (
             <div className="space-y-6 animate-fade-in">
               <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-xl font-bold text-gray-800">Manajemen Siswa</h2>
                  <p className="text-sm text-gray-500 mt-1">Input data siswa untuk keperluan absensi.</p>
               </div>
               
               <div className="flex gap-4 mb-4">
                  <button 
                    onClick={() => setStudentTabMode('MANUAL')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm ${studentTabMode === 'MANUAL' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Input Manual
                  </button>
                  <button 
                    onClick={() => setStudentTabMode('UPLOAD')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm ${studentTabMode === 'UPLOAD' ? 'bg-green-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Upload Data (Excel)
                  </button>
               </div>

               {studentTabMode === 'MANUAL' ? (
                 <>
                   <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <h3 className="font-bold text-gray-800 mb-4">{editingStudentId ? 'Edit Siswa' : 'Tambah Siswa Manual'}</h3>
                      <form onSubmit={handleStudentSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                         <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-gray-600 mb-1">Kelas</label>
                            <select 
                               value={studentForm.className}
                               onChange={(e) => setStudentForm({...studentForm, className: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                               {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>
                         <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-600 mb-1">Nama Siswa</label>
                            <input 
                               type="text" 
                               required
                               value={studentForm.name}
                               onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                               placeholder="Nama Lengkap..."
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                         </div>
                         <div className="flex gap-2">
                            {editingStudentId && (
                               <button 
                                  type="button" 
                                  onClick={() => { setEditingStudentId(null); setStudentForm({name:'', className: CLASSES[0]}); }}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                               >
                                  Batal
                               </button>
                            )}
                            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm">
                               {editingStudentId ? 'Simpan' : 'Tambah'}
                            </button>
                         </div>
                      </form>
                   </div>

                   <div>
                      <div className="flex justify-between items-center mb-2">
                         <h3 className="font-bold text-gray-800">Daftar Siswa</h3>
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">Filter Kelas:</span>
                            <select 
                               value={studentClassFilter}
                               onChange={(e) => setStudentClassFilter(e.target.value)}
                               className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                            >
                               <option value="">Semua</option>
                               {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-96 overflow-y-auto">
                         <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                               <tr>
                                  <th className="px-4 py-3 text-left font-bold text-gray-600">No</th>
                                  <th className="px-4 py-3 text-left font-bold text-gray-600">Kelas</th>
                                  <th className="px-4 py-3 text-left font-bold text-gray-600">Nama Siswa</th>
                                  <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                               {filteredStudents.length > 0 ? filteredStudents.map((s, idx) => (
                                  <tr key={s.id} className="hover:bg-gray-50">
                                     <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                                     <td className="px-4 py-2 text-gray-800 font-medium">
                                        <span className={`px-2 py-1 rounded text-xs border ${s.className.startsWith('VII') ? 'bg-green-50 border-green-200 text-green-700' : s.className.startsWith('VIII') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                           {s.className}
                                        </span>
                                     </td>
                                     <td className="px-4 py-2 text-gray-800">{s.name}</td>
                                     <td className="px-4 py-2 text-center flex justify-center gap-2">
                                        {onEditStudent && (
                                           <button onClick={() => startEditStudent(s)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                                        )}
                                        {onDeleteStudent && (
                                           <button onClick={() => onDeleteStudent(s.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                        )}
                                     </td>
                                  </tr>
                               )) : (
                                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Tidak ada data siswa.</td></tr>
                               )}
                            </tbody>
                         </table>
                      </div>
                   </div>

                   <div className="mt-4 text-right">
                      {isStudentSaved && <span className="text-green-600 font-medium text-sm animate-pulse mr-4">Disimpan!</span>}
                      <button 
                         onClick={handleStudentSaveTrigger}
                         className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md"
                      >
                         <Save size={18} className="inline mr-2" /> Simpan Perubahan
                      </button>
                   </div>
                 </>
               ) : (
                 <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                       <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                          <FileSpreadsheet size={20} /> Langkah 1: Download Format
                       </h3>
                       <p className="text-sm text-green-700 mb-4">Unduh template Excel, lalu isi data siswa (No, Kelas, Nama).</p>
                       <button 
                          onClick={downloadStudentTemplate}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm flex items-center gap-2"
                       >
                          <Download size={18} /> Download Template Excel
                       </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                       <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <Upload size={20} className="text-indigo-600" /> Langkah 2: Upload Data
                       </h3>
                       <p className="text-sm text-gray-500 mb-4">Pilih kelas target (opsional, jika di excel kosong) dan upload file.</p>
                       
                       <div className="flex flex-col md:flex-row gap-4 items-end">
                          <div className="w-full md:w-48">
                             <label className="block text-xs font-bold text-gray-600 mb-1">Target Kelas Default</label>
                             <select 
                                value={uploadClassTarget}
                                onChange={(e) => setUploadClassTarget(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                             >
                                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          </div>
                          <div className="flex-1 w-full">
                             <label className="block text-xs font-bold text-gray-600 mb-1">Pilih File Excel (.xlsx)</label>
                             <input 
                                type="file" 
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-slate-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-indigo-50 file:text-indigo-700
                                  hover:file:bg-indigo-100"
                             />
                          </div>
                       </div>
                    </div>

                    <div className="mt-4 text-right">
                      {isStudentSaved && <span className="text-green-600 font-medium text-sm animate-pulse mr-4">Disimpan!</span>}
                      <button 
                         onClick={handleStudentSaveTrigger}
                         className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md"
                      >
                         <Save size={18} className="inline mr-2" /> Simpan Perubahan
                      </button>
                   </div>
                 </div>
               )}
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;