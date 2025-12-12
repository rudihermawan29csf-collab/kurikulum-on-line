import React, { useState, useEffect, useRef } from 'react';
import TeacherTable from './components/TeacherTable';
import ScheduleTable from './components/ScheduleTable';
import GeminiAssistant from './components/GeminiAssistant';
import ClassTeacherSchedule from './components/ClassTeacherSchedule';
import LoginPage from './components/LoginPage';
import SettingsPanel from './components/SettingsPanel';
import { ViewMode, TeacherData, UserRole, AppSettings, AuthSettings, CalendarEvent, TeacherLeave, TeachingMaterial, TeachingJournal, Student, GradeRecord } from './types';
import { TEACHER_DATA as INITIAL_DATA, INITIAL_STUDENTS } from './constants';
import { Table as TableIcon, Search, Calendar, Ban, CalendarClock, Settings, Menu, LogOut, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentUser, setCurrentUser] = useState<string>(''); // Name of logged in teacher/class

  // --- APP SETTINGS STATE ---
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('appSettings');
      return saved ? JSON.parse(saved) : {
        academicYear: '2025/2026',
        semester: 'Genap',
        lastUpdated: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_Tut_Wuri_Handayani.png/800px-Logo_Tut_Wuri_Handayani.png',
        headmaster: 'Didik Sulistyo, M.M.Pd',
        headmasterNip: '196605181989011002'
      };
    } catch {
      return {
        academicYear: '2025/2026',
        semester: 'Genap',
        lastUpdated: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_Tut_Wuri_Handayani.png/800px-Logo_Tut_Wuri_Handayani.png',
        headmaster: 'Didik Sulistyo, M.M.Pd',
        headmasterNip: '196605181989011002'
      };
    }
  });

  // --- AUTH SETTINGS STATE ---
  const [authSettings, setAuthSettings] = useState<AuthSettings>(() => {
    try {
      const saved = localStorage.getItem('authSettings');
      return saved ? JSON.parse(saved) : {
        adminPassword: '', // Default to be handled in logic if empty
        teacherPasswords: {},
        classPasswords: {}
      };
    } catch {
      return {
        adminPassword: '',
        teacherPasswords: {},
        classPasswords: {}
      };
    }
  });

  // --- DATA STATES ---
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TABLE);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [teachers, setTeachers] = useState<TeacherData[]>(() => {
    try {
      const saved = localStorage.getItem('teacherData');
      return saved ? JSON.parse(saved) : INITIAL_DATA;
    } catch {
      return INITIAL_DATA;
    }
  });

  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('scheduleMap');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [unavailableConstraints, setUnavailableConstraints] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('unavailableConstraints');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('calendarEvents');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>(() => {
    try {
      const saved = localStorage.getItem('teacherLeaves');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('students');
      return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
    } catch {
      return INITIAL_STUDENTS;
    }
  });

  // --- JOURNAL STATES ---
  const [teachingMaterials, setTeachingMaterials] = useState<TeachingMaterial[]>(() => {
    try {
      const saved = localStorage.getItem('teachingMaterials');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [teachingJournals, setTeachingJournals] = useState<TeachingJournal[]>(() => {
    try {
      const saved = localStorage.getItem('teachingJournals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [studentGrades, setStudentGrades] = useState<GradeRecord[]>(() => {
    try {
      const saved = localStorage.getItem('studentGrades');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // --- UI STATES ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem('authSettings', JSON.stringify(authSettings));
  }, [authSettings]);

  useEffect(() => {
    localStorage.setItem('teacherData', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('unavailableConstraints', JSON.stringify(unavailableConstraints));
  }, [unavailableConstraints]);

  useEffect(() => {
    localStorage.setItem('scheduleMap', JSON.stringify(scheduleMap));
  }, [scheduleMap]);

  useEffect(() => {
    localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem('teacherLeaves', JSON.stringify(teacherLeaves));
  }, [teacherLeaves]);

  useEffect(() => {
    localStorage.setItem('students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('teachingMaterials', JSON.stringify(teachingMaterials));
  }, [teachingMaterials]);

  useEffect(() => {
    localStorage.setItem('teachingJournals', JSON.stringify(teachingJournals));
  }, [teachingJournals]);

  useEffect(() => {
    localStorage.setItem('studentGrades', JSON.stringify(studentGrades));
  }, [studentGrades]);


  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- HANDLERS ---

  const handleLogin = (role: UserRole, username?: string) => {
    setUserRole(role);
    if (username) setCurrentUser(username);
    
    // Set default view based on role
    if (role === 'ADMIN') {
      setViewMode(ViewMode.TABLE);
    } else {
      setViewMode(ViewMode.VIEW_SCHEDULES);
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentUser('');
    setIsMenuOpen(false);
  };

  const toggleHolidayConstraint = (code: string, day: string) => {
    setUnavailableConstraints(prev => {
      const currentDays = prev[code] || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      return { ...prev, [code]: newDays };
    });
  };

  const handleAddTeacher = (newTeacher: TeacherData) => {
    setTeachers(prev => [...prev, { ...newTeacher, id: Date.now() }]);
  };

  const handleEditTeacher = (updatedTeacher: TeacherData) => {
    setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
  };

  const handleDeleteTeacher = (id: number) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data guru ini?")) {
      setTeachers(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
  };

  const handleUpdateAuth = (newAuth: AuthSettings) => {
    setAuthSettings(newAuth);
  };

  const handleSaveSchedule = () => {
    localStorage.setItem('scheduleMap', JSON.stringify(scheduleMap));
    alert("Perubahan jadwal berhasil disimpan!");
  };

  const handleSaveHolidays = () => {
    localStorage.setItem('unavailableConstraints', JSON.stringify(unavailableConstraints));
    localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
    alert("Pengaturan hari libur berhasil disimpan!");
  };

  const toggleTeacherLeave = (leave: Omit<TeacherLeave, 'id'>) => {
    // Add new leave
    const newRecord = { ...leave, id: Date.now().toString() };
    setTeacherLeaves(prev => [...prev, newRecord]);
  };

  const handleEditTeacherLeave = (updatedLeave: TeacherLeave) => {
    setTeacherLeaves(prev => prev.map(l => l.id === updatedLeave.id ? updatedLeave : l));
  };

  const deleteTeacherLeave = (id: string) => {
    setTeacherLeaves(prev => prev.filter(l => l.id !== id));
  };

  // --- Student Handlers ---
  const handleAddStudent = (student: Student) => {
    setStudents(prev => [...prev, student]);
  };

  const handleEditStudent = (student: Student) => {
    setStudents(prev => prev.map(s => s.id === student.id ? student : s));
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const handleBulkAddStudents = (newStudents: Student[]) => {
    setStudents(prev => [...prev, ...newStudents]);
  };

  // --- Journal Handlers ---
  const handleAddMaterial = (material: TeachingMaterial) => {
    setTeachingMaterials(prev => [...prev, material]);
  };

  const handleDeleteMaterial = (id: string) => {
    setTeachingMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleAddJournal = (journal: TeachingJournal) => {
    setTeachingJournals(prev => [...prev, journal]);
  };

  const handleEditJournal = (updatedJournal: TeachingJournal) => {
    setTeachingJournals(prev => prev.map(j => j.id === updatedJournal.id ? updatedJournal : j));
  };

  const handleDeleteJournal = (id: string) => {
    setTeachingJournals(prev => prev.filter(j => j.id !== id));
  };

  // --- Grade Handlers ---
  const handleUpdateGrade = (grade: GradeRecord) => {
    setStudentGrades(prev => {
      const idx = prev.findIndex(g => g.id === grade.id);
      if (idx >= 0) {
        const newGrades = [...prev];
        newGrades[idx] = grade;
        return newGrades;
      } else {
        return [...prev, grade];
      }
    });
  };

  // --- RENDER LOGIN ---
  if (!userRole) {
    return (
      <LoginPage 
        onLogin={handleLogin} 
        authSettings={authSettings} 
        teacherData={teachers} 
      />
    );
  }

  // --- NAVIGATION OPTIONS BASED ON ROLE ---
  const getNavOptions = () => {
    const options = [];
    
    if (userRole === 'ADMIN') {
      options.push({ mode: ViewMode.TABLE, label: 'Data Tugas Guru', icon: <TableIcon size={18} /> });
      options.push({ mode: ViewMode.SCHEDULE, label: 'Edit Jadwal', icon: <Calendar size={18} /> });
    }

    // Everyone can view schedules
    options.push({ mode: ViewMode.VIEW_SCHEDULES, label: 'Lihat Jadwal', icon: <CalendarClock size={18} /> });

    if (userRole === 'ADMIN') {
      options.push({ mode: ViewMode.SETTINGS, label: 'Pengaturan', icon: <Settings size={18} /> });
    }

    return options;
  };

  const navOptions = getNavOptions();

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            
            {/* Logo & Info */}
            <div className="flex items-center gap-4">
              <img 
                src={appSettings.logoUrl}
                alt="Logo Sekolah" 
                className="h-20 w-auto drop-shadow-sm object-contain"
                onError={(e) => {
                  e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_Tut_Wuri_Handayani.png/800px-Logo_Tut_Wuri_Handayani.png";
                  e.currentTarget.onerror = null;
                }}
              />
              <div>
                <h1 className="text-lg font-extrabold text-gray-900 leading-none tracking-tight">Sistem Pembagian Tugas</h1>
                <h2 className="text-base font-bold text-indigo-700 leading-tight mt-1">SMPN 3 Pacet</h2>
                <div className="mt-1 flex flex-col">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                      Semester {appSettings.semester} • TA {appSettings.academicYear}
                   </p>
                   <p className="text-[10px] text-orange-600 font-medium">
                      Update: {appSettings.lastUpdated}
                   </p>
                </div>
              </div>
            </div>
            
            {/* Right Controls (Menu) */}
            <div className="relative" ref={menuRef}>
               <button 
                 onClick={() => setIsMenuOpen(!isMenuOpen)}
                 className="flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all shadow-sm group"
               >
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-gray-800">Menu Navigasi</p>
                    <p className="text-[10px] text-gray-500 capitalize">
                      {userRole === 'ADMIN' ? 'Administrator' : currentUser || 'User'}
                    </p>
                  </div>
                  <div className="bg-indigo-600 text-white p-2 rounded-lg group-hover:bg-indigo-700 transition-colors">
                    {isMenuOpen ? <ChevronDown size={20} className="rotate-180 transition-transform" /> : <Menu size={20} />}
                  </div>
               </button>

               {/* Dropdown Menu */}
               {isMenuOpen && (
                 <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in z-50">
                    <div className="p-2 border-b border-gray-100 bg-gray-50/50 md:hidden">
                       <p className="text-xs font-bold text-gray-700 px-2">Masuk sebagai:</p>
                       <p className="text-sm font-bold text-indigo-700 px-2 capitalize">{userRole}</p>
                    </div>
                    
                    <div className="p-2 space-y-1">
                       {navOptions.map(opt => (
                         <button
                           key={opt.mode}
                           onClick={() => {
                             setViewMode(opt.mode);
                             setIsMenuOpen(false);
                           }}
                           className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-bold rounded-lg transition-colors ${
                             viewMode === opt.mode 
                               ? 'bg-indigo-50 text-indigo-700' 
                               : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                           }`}
                         >
                           <span className={viewMode === opt.mode ? 'text-indigo-600' : 'text-gray-400'}>
                             {opt.icon}
                           </span>
                           {opt.label}
                         </button>
                       ))}
                    </div>

                    <div className="p-2 border-t border-gray-100 bg-gray-50">
                       <button 
                         onClick={handleLogout}
                         className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                       >
                          <LogOut size={18} />
                          Keluar
                       </button>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" key={viewMode}>
        
        {/* Search Bar (Only for Table View) */}
        {viewMode === ViewMode.TABLE && (
           <div className="mb-6 max-w-md mx-auto md:mx-0">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari nama guru, mapel, atau tugas..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-shadow"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
           </div>
        )}

        {/* Views */}
        <div className="animate-fade-in">
          {viewMode === ViewMode.TABLE && userRole === 'ADMIN' && (
            <TeacherTable 
              data={teachers} 
              searchTerm={searchTerm} 
              onAdd={handleAddTeacher}
              onEdit={handleEditTeacher}
              onDelete={handleDeleteTeacher}
              appSettings={appSettings}
            />
          )}
          {viewMode === ViewMode.SCHEDULE && userRole === 'ADMIN' && (
             <ScheduleTable 
               teacherData={teachers} 
               unavailableConstraints={unavailableConstraints}
               scheduleMap={scheduleMap}
               setScheduleMap={setScheduleMap}
               onSave={handleSaveSchedule}
             />
          )}
          {viewMode === ViewMode.VIEW_SCHEDULES && (
             <ClassTeacherSchedule 
               key={`${userRole}-${currentUser}`} // FORCE REMOUNT WHEN USER CHANGES
               teacherData={teachers} 
               scheduleMap={scheduleMap}
               currentUser={currentUser}
               role={userRole}
               appSettings={appSettings} // PASS APP SETTINGS
               calendarEvents={calendarEvents}
               teacherLeaves={teacherLeaves}
               students={students} 
               // Journal Props
               teachingMaterials={teachingMaterials}
               onAddMaterial={handleAddMaterial}
               onDeleteMaterial={handleDeleteMaterial}
               teachingJournals={teachingJournals}
               onAddJournal={handleAddJournal}
               onEditJournal={handleEditJournal}
               onDeleteJournal={handleDeleteJournal}
               // Grades Props
               studentGrades={studentGrades}
               onUpdateGrade={handleUpdateGrade}
             />
          )}
          {viewMode === ViewMode.SETTINGS && userRole === 'ADMIN' && (
             <SettingsPanel 
                settings={appSettings} 
                onSave={handleUpdateSettings}
                authSettings={authSettings}
                onSaveAuth={handleUpdateAuth}
                teacherData={teachers}
                teacherLeaves={teacherLeaves}
                onToggleLeave={toggleTeacherLeave}
                onEditLeave={handleEditTeacherLeave}
                onDeleteLeave={deleteTeacherLeave}
                calendarEvents={calendarEvents}
                onUpdateCalendar={(events) => setCalendarEvents(events)}
                unavailableConstraints={unavailableConstraints}
                onToggleConstraint={toggleHolidayConstraint}
                // Student Props
                students={students}
                onAddStudent={handleAddStudent}
                onEditStudent={handleEditStudent}
                onDeleteStudent={handleDeleteStudent}
                onBulkAddStudents={handleBulkAddStudents}
             />
          )}
        </div>
      </main>

      {/* AI Assistant (Only for Admin for analyzing load) */}
      {userRole === 'ADMIN' && <GeminiAssistant teacherData={teachers} />}

    </div>
  );
};

export default App;