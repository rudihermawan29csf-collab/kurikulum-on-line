import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TeacherData, UserRole, CalendarEvent, TeacherLeave, TeachingMaterial, TeachingJournal, Student, AppSettings } from '../types';
import { SCHEDULE_DATA, CLASSES, COLOR_PALETTE } from '../constants';
import { User, School, ClipboardList, BookOpen, Download, FileText, CheckCircle, Clock, Save, Info, PenTool, Plus, Trash2, ChevronDown, BarChart3, Edit2, X, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ClassTeacherScheduleProps {
  teacherData: TeacherData[];
  scheduleMap: Record<string, string>;
  currentUser?: string;
  role?: UserRole;
  appSettings?: AppSettings;
  calendarEvents?: CalendarEvent[];
  teacherLeaves?: TeacherLeave[];
  students?: Student[];
  
  // Journal Props
  teachingMaterials?: TeachingMaterial[];
  onAddMaterial?: (m: TeachingMaterial) => void;
  onDeleteMaterial?: (id: string) => void;
  teachingJournals?: TeachingJournal[];
  onAddJournal?: (j: TeachingJournal) => void;
  onEditJournal?: (j: TeachingJournal) => void;
  onDeleteJournal?: (id: string) => void;
}

type TabMode = 'CLASS' | 'TEACHER' | 'ATTENDANCE' | 'JOURNAL' | 'MONITORING';

type AttendanceStatus = 'HADIR' | 'TIDAK_HADIR' | 'DINAS_LUAR' | null;
interface AttendanceRecord {
  [key: string]: AttendanceStatus; // key: "date-jam-class" -> status
}

const ClassTeacherSchedule: React.FC<ClassTeacherScheduleProps> = ({ 
  teacherData, 
  scheduleMap, 
  currentUser, 
  role,
  appSettings,
  calendarEvents = [],
  teacherLeaves = [],
  students = [],
  teachingMaterials = [],
  onAddMaterial,
  onDeleteMaterial,
  teachingJournals = [],
  onAddJournal,
  onEditJournal,
  onDeleteJournal
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>(() => {
    if (role === 'TEACHER') return 'TEACHER';
    if (role === 'STUDENT') return 'CLASS'; 
    return 'CLASS';
  });

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (role === 'STUDENT' && currentUser && CLASSES.includes(currentUser)) {
      return currentUser;
    }
    return CLASSES[0];
  });

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (role === 'TEACHER' && currentUser) {
      return currentUser;
    }
    return "";
  });

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord>(() => {
    try {
      const saved = localStorage.getItem('attendanceRecords');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // --- JOURNAL STATE ---
  const [journalMode, setJournalMode] = useState<'INPUT_MATERI' | 'INPUT_JURNAL'>('INPUT_JURNAL');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  
  // Monitoring State
  const [monitoringClass, setMonitoringClass] = useState<string>(CLASSES[0]);
  const [isMonitoringDownloadOpen, setIsMonitoringDownloadOpen] = useState(false);
  const monitoringDownloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (monitoringDownloadRef.current && !monitoringDownloadRef.current.contains(event.target as Node)) {
            setIsMonitoringDownloadOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Material Form
  const [matForm, setMatForm] = useState<{
    semester: '1' | '2';
    classes: string[];
    chapter: string;
    subChapters: string[];
  }>({
    semester: '2', 
    classes: [],
    chapter: '',
    subChapters: ['']
  });

  // Journal Form
  const [jourForm, setJourForm] = useState<{
    date: string;
    semester: '1' | '2';
    jamKe: string;
    className: string;
    chapter: string;
    subChapter: string;
    activity: string;
    notes: string;
    studentAttendance: Record<string, 'H' | 'S' | 'I' | 'A' | 'DL'>;
  }>({
    date: new Date().toISOString().split('T')[0],
    semester: '2',
    jamKe: '',
    className: '',
    chapter: '',
    subChapter: '',
    activity: '',
    notes: '',
    studentAttendance: {}
  });

  // Unique Teacher Names
  const teacherNames = useMemo(() => {
    return Array.from(new Set(teacherData.map(t => t.name))).sort();
  }, [teacherData]);

  // Code to Data Map
  const codeToDataMap = useMemo(() => {
    const map: Record<string, { subject: string, name: string }> = {};
    teacherData.forEach(t => {
      map[t.code] = { subject: t.subject, name: t.name };
    });
    return map;
  }, [teacherData]);

  // Generate color map
  const codeColorMap = useMemo(() => {
    const uniqueNames: string[] = [];
    teacherData.forEach(t => {
       if(!uniqueNames.includes(t.name)) uniqueNames.push(t.name);
    });
    const nameToColor: Record<string, string> = {};
    uniqueNames.forEach((name: string, index: number) => {
      nameToColor[name] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    });
    const codeMap: Record<string, string> = {};
    teacherData.forEach(t => {
      codeMap[t.code] = nameToColor[t.name];
    });
    return codeMap;
  }, [teacherData]);

  const getClassColor = (cls: string) => {
    if (cls.startsWith('VII ')) return 'bg-green-100 text-green-800 border border-green-200';
    if (cls.startsWith('VIII ')) return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    if (cls.startsWith('IX ')) return 'bg-red-100 text-red-800 border border-red-200';
    return 'bg-gray-100 text-gray-800';
  };

  const getDayNameFromDate = (dateString: string) => {
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
    const d = new Date(dateString);
    return days[d.getDay()];
  };

  // --- DOWNLOAD HANDLERS ---
  const downloadClassSchedulePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Jadwal Pelajaran Kelas ${selectedClass}`, 14, 15);
    doc.setFontSize(10);
    doc.text('SMPN 3 Pacet - Semester Genap 2025/2026', 14, 21);

    let finalY = 25;

    SCHEDULE_DATA.forEach(daySchedule => {
      const rows = daySchedule.rows;
      if (rows.length === 0) return;
      if (finalY > 270) { doc.addPage(); finalY = 15; }
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text(`HARI: ${daySchedule.day}`, 14, finalY + 5);
      
      const tableBody = rows.map(row => {
        if (row.activity) {
            return [row.jam, row.waktu, { content: row.activity, colSpan: 3, styles: { fillColor: [255, 237, 213], halign: 'center', textColor: [154, 52, 18] } }];
        }
        const key = `${daySchedule.day}-${row.jam}-${selectedClass}`;
        const code = scheduleMap[key];
        const info = code ? codeToDataMap[String(code)] : null;
        return [row.jam, row.waktu, code || '-', info?.subject || '-', info?.name || '-'];
      });

      autoTable(doc, {
        startY: finalY + 8,
        head: [['Jam', 'Waktu', 'Kode', 'Mata Pelajaran', 'Guru']],
        body: tableBody as any,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 50 }, 4: { cellWidth: 'auto' } },
        didParseCell: (data) => { if (data.section === 'body' && data.column.index === 2 && data.cell.raw !== '-') { data.cell.styles.fontStyle = 'bold'; } }
      });
      finalY = (doc as any).lastAutoTable.finalY + 10;
    });
    doc.save(`Jadwal_Kelas_${selectedClass.replace(' ', '_')}.pdf`);
  };

  const downloadTeacherSchedulePDF = () => {
    if (!selectedTeacherId) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Jadwal Mengajar: ${selectedTeacherId}`, 14, 15);
    doc.setFontSize(10);
    doc.text('SMPN 3 Pacet - Semester Genap 2025/2026', 14, 21);

    let counter = 1;
    const tableBody: any[] = [];
    const myCodes = teacherData.filter(t => t.name === selectedTeacherId).map(t => t.code);

    SCHEDULE_DATA.forEach(day => {
       day.rows.forEach(row => {
          if (row.activity) return;
          CLASSES.forEach(cls => {
             const key = `${day.day}-${row.jam}-${cls}`;
             const scheduledCode = scheduleMap[key];
             if (scheduledCode && myCodes.includes(scheduledCode)) {
                const info = codeToDataMap[String(scheduledCode)];
                tableBody.push([counter++, row.jam, row.waktu, day.day, cls, scheduledCode, info?.subject || '-']);
             }
          });
       });
    });

    autoTable(doc, {
        startY: 25,
        head: [['No', 'Jam Ke', 'Waktu', 'Hari', 'Kelas', 'Kode', 'Mata Pelajaran']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105] },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 25, halign: 'center' }, 3: { cellWidth: 25 }, 4: { cellWidth: 20, halign: 'center' } }
    });

    // Add Signature Block
    const pageHeight = doc.internal.pageSize.height;
    const sigY = (doc as any).lastAutoTable.finalY + 20;
    
    // Check if enough space, else new page
    if (sigY + 40 > pageHeight) doc.addPage();
    
    const finalSigY = sigY + 40 > pageHeight ? 20 : sigY;
    
    // Date
    doc.setFontSize(10);
    doc.text(`Mojokerto, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 130, finalSigY);
    
    // Signatures
    doc.text('Guru Mata Pelajaran', 20, finalSigY + 10);
    doc.text('Kepala SMPN 3 Pacet', 130, finalSigY + 10);
    
    // Names
    doc.text(selectedTeacherId, 20, finalSigY + 35);
    doc.text(appSettings?.headmaster || '.........................', 130, finalSigY + 35);
    
    // NIPs
    // Find teacher NIP
    const teacherNip = teacherData.find(t => t.name === selectedTeacherId)?.nip || '................';
    doc.text(`NIP. ${teacherNip}`, 20, finalSigY + 40);
    doc.text(`NIP. ${appSettings?.headmasterNip || '................'}`, 130, finalSigY + 40);

    doc.save(`Jadwal_Guru_${selectedTeacherId.replace(' ', '_')}.pdf`);
  };

  // --- ATTENDANCE HANDLERS ---
  const handleAttendanceChange = (key: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [key]: status
    }));
  };

  const resetAttendanceRow = (key: string) => {
     setAttendanceData(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
     });
  };

  // --- ATTENDANCE INPUT ---
  const renderAttendanceInput = () => {
    const dayName = getDayNameFromDate(attendanceDate);
    const daySchedule = SCHEDULE_DATA.find(d => d.day === dayName);
    
    // Check Holiday
    const holidayInfo = calendarEvents.find(e => e.date === attendanceDate);

    // Check Teacher Leaves
    const getRelevantAbsences = () => {
      if (!daySchedule) return [];
      // Get all teachers scheduled for this class on this day
      const absentTeachers: { name: string; subject: string; type: string; desc: string }[] = [];
      
      daySchedule.rows.forEach(row => {
         if (row.activity) return;
         const key = `${dayName}-${row.jam}-${selectedClass}`;
         const code = scheduleMap[key];
         if (code) {
            const tInfo = codeToDataMap[code];
            // Check if this teacher has a leave on this date
            const teacherIdObj = teacherData.find(t => t.name === tInfo.name);
            if (teacherIdObj) {
               const leave = teacherLeaves.find(l => l.date === attendanceDate && l.teacherId === teacherIdObj.id);
               if (leave) {
                  // Avoid duplicates
                  if (!absentTeachers.some(a => a.name === tInfo.name)) {
                     absentTeachers.push({
                        name: tInfo.name,
                        subject: tInfo.subject,
                        type: leave.type,
                        desc: leave.description || '-'
                     });
                  }
               }
            }
         }
      });
      return absentTeachers;
    };

    const relevantAbsences = getRelevantAbsences();

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
           <div>
             <label className="block text-xs font-bold text-gray-500 mb-1">Tanggal Kehadiran</label>
             <input 
               type="date" 
               value={attendanceDate}
               onChange={(e) => setAttendanceDate(e.target.value)}
               className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
             />
           </div>
           <div className="flex-1">
             <div className="text-sm font-bold text-gray-800">Hari: {dayName}</div>
             {holidayInfo ? (
               <div className="text-xs text-red-600 font-bold mt-1">
                 Libur Nasional: {holidayInfo.description}
               </div>
             ) : (
               <div className="text-xs text-green-600 mt-1">Hari Aktif Sekolah</div>
             )}
           </div>
           <button 
             onClick={() => { localStorage.setItem('attendanceRecords', JSON.stringify(attendanceData)); alert('Disimpan!'); }}
             className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm flex items-center gap-2"
             disabled={!!holidayInfo}
           >
             <Save size={16} /> Simpan
           </button>
        </div>

        {relevantAbsences.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
             <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                <Info size={16} /> Info Guru Berhalangan Hadir
             </h4>
             <ul className="space-y-1">
                {relevantAbsences.map((ab, idx) => (
                   <li key={idx} className="text-xs text-yellow-800 bg-white/50 p-2 rounded border border-yellow-100">
                      <strong>{ab.name}</strong> ({ab.subject}) - <span className="uppercase font-bold">{ab.type.replace('_', ' ')}</span>: {ab.desc}
                   </li>
                ))}
             </ul>
          </div>
        )}

        {daySchedule ? (
           <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
             <table className="min-w-full divide-y divide-gray-200 text-sm">
               <thead className="bg-orange-50">
                 <tr>
                   <th className="px-4 py-3 text-left font-bold text-gray-600">Jam</th>
                   <th className="px-4 py-3 text-left font-bold text-gray-600">Mapel / Guru</th>
                   <th className="px-4 py-3 text-center font-bold text-gray-600">Kehadiran Guru</th>
                   <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-200">
                 {daySchedule.rows.map((row, idx) => {
                   if (row.activity) {
                     return (
                        <tr key={idx} className="bg-gray-50">
                           <td className="px-4 py-2 text-center text-xs font-bold text-gray-500">{row.jam}</td>
                           <td colSpan={3} className="px-4 py-2 text-center text-xs text-gray-500 italic">{row.activity}</td>
                        </tr>
                     );
                   }
                   const key = `${dayName}-${row.jam}-${selectedClass}`;
                   const code = scheduleMap[key];
                   const info = code ? codeToDataMap[code] : null;
                   const status = attendanceData[key];

                   return (
                     <tr key={idx} className="hover:bg-gray-50">
                       <td className="px-4 py-3 font-medium text-gray-700">{row.jam} ({row.waktu})</td>
                       <td className="px-4 py-3">
                         {info ? (
                           <div>
                             <div className="font-bold text-indigo-700">{info.subject}</div>
                             <div className="text-xs text-gray-500">{info.name}</div>
                           </div>
                         ) : <span className="text-gray-400">- Kosong -</span>}
                       </td>
                       <td className="px-4 py-3">
                         {holidayInfo ? (
                            <div className="text-center text-xs text-gray-400 font-italic">Libur</div>
                         ) : info ? (
                           <div className="flex justify-center gap-4">
                             {['HADIR', 'TIDAK_HADIR', 'DINAS_LUAR'].map((s) => (
                               <label key={s} className="flex items-center gap-1 cursor-pointer">
                                 <input 
                                   type="radio" 
                                   name={`att-${key}`}
                                   checked={status === s}
                                   onChange={() => handleAttendanceChange(key, s as AttendanceStatus)}
                                   className={`focus:ring-0 ${
                                     s === 'HADIR' ? 'text-green-600' : 
                                     s === 'TIDAK_HADIR' ? 'text-red-600' : 'text-purple-600'
                                   }`}
                                 />
                                 <span className={`text-xs font-bold ${
                                     s === 'HADIR' ? 'text-green-700' : 
                                     s === 'TIDAK_HADIR' ? 'text-red-700' : 'text-purple-700'
                                 }`}>
                                   {s === 'HADIR' ? 'Hadir' : s === 'TIDAK_HADIR' ? 'Absen' : 'DL'}
                                 </span>
                               </label>
                             ))}
                           </div>
                         ) : null}
                       </td>
                       <td className="px-4 py-3 text-center">
                          {status && !holidayInfo && (
                             <button 
                               onClick={() => resetAttendanceRow(key)}
                               className="text-gray-400 hover:text-red-500 p-1 hover:bg-gray-100 rounded transition-colors"
                               title="Reset / Hapus Input"
                             >
                                <Trash2 size={16} />
                             </button>
                          )}
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
        ) : (
           <div className="p-8 text-center text-gray-500">Pilih tanggal untuk melihat jadwal.</div>
        )}
      </div>
    );
  };

  // --- JOURNAL HANDLERS & RENDER ---
  const myTeachingSlots = useMemo(() => {
    if (!currentUser || role !== 'TEACHER') return [];
    const myCodes = teacherData.filter(t => t.name === currentUser).map(t => t.code);
    const slots: string[] = [];
    
    SCHEDULE_DATA.forEach(day => {
      day.rows.forEach(row => {
        if (row.activity) return;
        CLASSES.forEach(cls => {
          const key = `${day.day}-${row.jam}-${cls}`;
          const code = scheduleMap[key];
          if (code && myCodes.includes(code)) {
             slots.push(`${day.day}|${row.jam}|${cls}`);
          }
        });
      });
    });
    return slots;
  }, [currentUser, role, teacherData, scheduleMap]);

  // Update JourForm when jamKe changes (multi-select) to set class
  useEffect(() => {
    if (jourForm.jamKe) {
       const firstSlot = jourForm.jamKe.split(',')[0];
       const parts = firstSlot.split('|');
       if (parts.length >= 3) {
          setJourForm(prev => ({ ...prev, className: parts[2] }));
       }
    }
  }, [jourForm.jamKe]);

  // Populate student attendance when class changes
  useEffect(() => {
     if (jourForm.className && students.length > 0) {
        const classStudents = students.filter(s => s.className === jourForm.className);
        setJourForm(prev => {
            const newAttendance = { ...prev.studentAttendance };
            classStudents.forEach(s => {
                if (!newAttendance[s.id]) newAttendance[s.id] = 'H';
            });
            return { ...prev, studentAttendance: newAttendance };
        });
     }
  }, [jourForm.className, students]);

  const handleMatClassToggle = (cls: string) => {
    setMatForm(prev => ({
      ...prev,
      classes: prev.classes.includes(cls) ? prev.classes.filter(c => c !== cls) : [...prev.classes, cls]
    }));
  };

  const handleSubChapterChange = (index: number, val: string) => {
    const newSubs = [...matForm.subChapters];
    newSubs[index] = val;
    setMatForm(prev => ({ ...prev, subChapters: newSubs }));
  };

  const addSubChapter = () => setMatForm(prev => ({ ...prev, subChapters: [...prev.subChapters, ''] }));
  
  const removeSubChapter = (index: number) => {
    if (matForm.subChapters.length === 1) return;
    setMatForm(prev => ({ ...prev, subChapters: prev.subChapters.filter((_, i) => i !== index) }));
  };

  const saveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onAddMaterial) return;
    if (matForm.classes.length === 0) { alert("Pilih minimal satu kelas!"); return; }
    onAddMaterial({
      id: Date.now().toString(),
      teacherName: currentUser,
      semester: matForm.semester,
      classes: matForm.classes,
      chapter: matForm.chapter,
      subChapters: matForm.subChapters.filter(s => s.trim() !== '')
    });
    setMatForm({ semester: '2', classes: [], chapter: '', subChapters: [''] });
    alert("Materi berhasil ditambahkan!");
  };

  const availableChapters = useMemo(() => {
    if (!currentUser) return [];
    return teachingMaterials.filter(m => m.teacherName === currentUser && m.semester === jourForm.semester && m.classes.includes(jourForm.className));
  }, [teachingMaterials, currentUser, jourForm.semester, jourForm.className]);

  const availableSubChapters = useMemo(() => {
    const selectedMat = availableChapters.find(m => m.chapter === jourForm.chapter);
    return selectedMat ? selectedMat.subChapters : [];
  }, [availableChapters, jourForm.chapter]);

  const saveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const journalData: TeachingJournal = { id: editingJournalId || Date.now().toString(), teacherName: currentUser, ...jourForm };
    if (editingJournalId && onEditJournal) {
      onEditJournal(journalData);
      setEditingJournalId(null);
      alert("Perubahan jurnal berhasil disimpan!");
    } else if (onAddJournal) {
      onAddJournal(journalData);
      alert("Jurnal berhasil disimpan!");
    }
    setJourForm({ date: new Date().toISOString().split('T')[0], semester: '2', jamKe: '', className: '', chapter: '', subChapter: '', activity: '', notes: '', studentAttendance: {} });
  };

  const handleEditJournalClick = (journal: TeachingJournal) => {
    setEditingJournalId(journal.id);
    setJourForm({
      date: journal.date,
      semester: journal.semester,
      jamKe: journal.jamKe,
      className: journal.className,
      chapter: journal.chapter,
      subChapter: journal.subChapter,
      activity: journal.activity,
      notes: journal.notes,
      studentAttendance: journal.studentAttendance || {}
    });
    setJournalMode('INPUT_JURNAL');
  };

  const handleCancelEdit = () => {
    setEditingJournalId(null);
    setJourForm({
      date: new Date().toISOString().split('T')[0],
      semester: '2',
      jamKe: '',
      className: '',
      chapter: '',
      subChapter: '',
      activity: '',
      notes: '',
      studentAttendance: {}
    });
    setJournalMode('INPUT_JURNAL');
  };

  const myJournals = useMemo(() => {
    return teachingJournals.filter(j => j.teacherName === currentUser).sort((a, b) => b.date.localeCompare(a.date));
  }, [teachingJournals, currentUser]);

  const handleStudentAttendanceChange = (studentId: string, status: 'H' | 'S' | 'I' | 'A' | 'DL') => {
      setJourForm(prev => ({ ...prev, studentAttendance: { ...prev.studentAttendance, [studentId]: status } }));
  };

  const handleJamKeSelection = (slotVal: string) => {
      setJourForm(prev => {
          let currentSelected = prev.jamKe ? prev.jamKe.split(',') : [];
          if (currentSelected.includes(slotVal)) {
              currentSelected = currentSelected.filter(s => s !== slotVal);
          } else {
              if (currentSelected.length > 0 && currentSelected[0]) {
                 const existingClass = currentSelected[0].split('|')[2];
                 const newClass = slotVal.split('|')[2];
                 if (existingClass !== newClass) {
                    alert("Tidak dapat memilih jam mengajar dari kelas yang berbeda dalam satu jurnal.");
                    return prev;
                 }
              }
              currentSelected.push(slotVal);
          }
          return { ...prev, jamKe: currentSelected.join(',') };
      });
  };

  const handleJournalSubChapterToggle = (sub: string) => {
      setJourForm(prev => {
          let current = prev.subChapter ? prev.subChapter.split(',') : [];
          current = current.map(s => s.trim()).filter(s => s !== '');
          if (current.includes(sub)) current = current.filter(s => s !== sub);
          else current.push(sub);
          return { ...prev, subChapter: current.join(',') };
      });
  };

  // --- ATTENDANCE MONITORING ---
  const renderAttendanceMonitoring = () => {
     // Filter journals for currentUser + monitoringClass
     const classJournals = teachingJournals
        .filter(j => j.teacherName === currentUser && j.className === monitoringClass)
        .sort((a,b) => a.date.localeCompare(b.date));

     const classStudents = students.filter(s => s.className === monitoringClass);

     // Group dates (cast to string[] to help TS)
     const dates: string[] = Array.from(new Set(classJournals.map(j => j.date))).sort();

     const downloadMonitoringPDF = (size: 'a4' | 'f4') => {
        const doc = new jsPDF('l', 'mm', size === 'f4' ? [330, 210] : 'a4');
        doc.setFontSize(14);
        doc.text(`Monitoring Absensi Siswa - Kelas ${monitoringClass}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Guru: ${currentUser} - Semester Genap 2025/2026`, 14, 21);

        const head = [['No', 'Nama Siswa', ...dates.map(d => d.split('-').slice(1).reverse().join('/')), 'H', 'S', 'I', 'A', 'DL']];
        const body = classStudents.map((s, i) => {
           let h=0, sk=0, iz=0, al=0, dl=0;
           const dateCells = dates.map(d => {
              // Find journal for this date (handle multiple slots same date)
              const journalsOnDate = classJournals.filter(j => j.date === d);
              // Pick the status from the first journal entry of the day that has record
              let status = '-';
              for(const j of journalsOnDate) {
                 if(j.studentAttendance?.[s.id]) {
                    status = j.studentAttendance[s.id];
                    break;
                 }
              }
              if(status==='H') h++;
              if(status==='S') sk++;
              if(status==='I') iz++;
              if(status==='A') al++;
              if(status==='DL') dl++;
              return status;
           });
           return [i+1, s.name, ...dateCells, h, sk, iz, al, dl];
        });

        autoTable(doc, {
           startY: 25,
           head: head,
           body: body as any[][],
           theme: 'grid',
           styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
           columnStyles: { 1: { halign: 'left' } }
        });
        
        doc.save(`Monitoring_Absensi_${monitoringClass}.pdf`);
     };

     const downloadMonitoringExcel = () => {
        const head = ['No', 'Nama Siswa', ...dates, 'H', 'S', 'I', 'A', 'DL'];
        const body = classStudents.map((s, i) => {
           let h=0, sk=0, iz=0, al=0, dl=0;
           const dateCells = dates.map(d => {
              const journalsOnDate = classJournals.filter(j => j.date === d);
              let status = '-';
              for(const j of journalsOnDate) {
                 if(j.studentAttendance?.[s.id]) {
                    status = j.studentAttendance[s.id];
                    break;
                 }
              }
              if(status==='H') h++;
              if(status==='S') sk++;
              if(status==='I') iz++;
              if(status==='A') al++;
              if(status==='DL') dl++;
              return status;
           });
           return [i+1, s.name, ...dateCells, h, sk, iz, al, dl];
        });
        
        const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Absensi ${monitoringClass}`);
        XLSX.writeFile(wb, `Monitoring_Absensi_${monitoringClass}.xlsx`);
     };

     return (
        <div className="space-y-4 animate-fade-in">
           <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2">
                 <label className="text-sm font-bold text-gray-700">Pilih Kelas:</label>
                 <select 
                    value={monitoringClass}
                    onChange={(e) => setMonitoringClass(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                 >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              <div className="relative" ref={monitoringDownloadRef}>
                 <button 
                   onClick={() => setIsMonitoringDownloadOpen(!isMonitoringDownloadOpen)}
                   className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow hover:bg-indigo-700"
                 >
                    <Download size={16} /> Download
                    <ChevronDown size={14} />
                 </button>
                 {isMonitoringDownloadOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden z-20">
                       <button onClick={() => downloadMonitoringPDF('a4')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">PDF (A4)</button>
                       <button onClick={() => downloadMonitoringPDF('f4')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">PDF (F4)</button>
                       <button onClick={downloadMonitoringExcel} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Excel</button>
                    </div>
                 )}
              </div>
           </div>

           <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                 <thead className="bg-gray-50">
                    <tr>
                       <th rowSpan={2} className="px-4 py-3 text-left font-bold text-gray-600 border-r">No</th>
                       <th rowSpan={2} className="px-4 py-3 text-left font-bold text-gray-600 border-r w-48">Nama Siswa</th>
                       <th colSpan={dates.length} className="px-4 py-2 text-center font-bold text-gray-600 border-b">Tanggal Pertemuan</th>
                       <th colSpan={5} className="px-4 py-2 text-center font-bold text-gray-600 border-b border-l">Rekapitulasi</th>
                    </tr>
                    <tr>
                       {dates.map(d => (
                          <th key={d} className="px-2 py-2 text-center font-mono text-gray-500 border-r min-w-[40px]">
                             {d.split('-').slice(1).reverse().join('/')}
                          </th>
                       ))}
                       {['H', 'S', 'I', 'A', 'DL'].map(h => (
                          <th key={h} className="px-2 py-2 text-center font-bold text-gray-600 border-l">{h}</th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200">
                    {classStudents.map((s, idx) => {
                       let h=0, sk=0, iz=0, al=0, dl=0;
                       const cells = dates.map(d => {
                          const journalsOnDate = classJournals.filter(j => j.date === d);
                          let status = '-';
                          for(const j of journalsOnDate) {
                             if(j.studentAttendance?.[s.id]) {
                                status = j.studentAttendance[s.id];
                                break;
                             }
                          }
                          if(status==='H') h++; else if(status==='S') sk++; else if(status==='I') iz++; else if(status==='A') al++; else if(status==='DL') dl++;
                          
                          let colorClass = 'text-gray-300';
                          if(status==='H') colorClass = 'text-green-600 font-bold';
                          if(status==='S') colorClass = 'text-yellow-600 font-bold';
                          if(status==='I') colorClass = 'text-blue-600 font-bold';
                          if(status==='A') colorClass = 'text-red-600 font-bold';
                          if(status==='DL') colorClass = 'text-purple-600 font-bold';

                          return <td key={d} className={`px-2 py-2 text-center border-r ${colorClass}`}>{status}</td>;
                       });

                       return (
                          <tr key={s.id} className="hover:bg-gray-50">
                             <td className="px-4 py-2 text-center text-gray-500 border-r">{idx+1}</td>
                             <td className="px-4 py-2 font-medium text-gray-800 border-r">{s.name}</td>
                             {cells}
                             <td className="px-2 py-2 text-center font-bold text-green-700 bg-green-50/50 border-l">{h}</td>
                             <td className="px-2 py-2 text-center font-bold text-yellow-700 bg-yellow-50/50">{sk}</td>
                             <td className="px-2 py-2 text-center font-bold text-blue-700 bg-blue-50/50">{iz}</td>
                             <td className="px-2 py-2 text-center font-bold text-red-700 bg-red-50/50">{al}</td>
                             <td className="px-2 py-2 text-center font-bold text-purple-700 bg-purple-50/50">{dl}</td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
           
           <div className="flex gap-4 text-xs font-medium text-gray-500 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> H = Hadir</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> S = Sakit</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> I = Izin</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> A = Alpha</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> DL = Dinas Luar</span>
           </div>
        </div>
     );
  };

  const renderJournalTab = () => (
    <div className="space-y-6 animate-fade-in">
       <div className="flex gap-0 border-b border-gray-200">
          <button 
             onClick={() => setJournalMode('INPUT_JURNAL')}
             className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${journalMode === 'INPUT_JURNAL' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <PenTool size={18} /> Input Jurnal
          </button>
          <button 
             onClick={() => setJournalMode('INPUT_MATERI')}
             className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${journalMode === 'INPUT_MATERI' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <BookOpen size={18} /> Input Materi
          </button>
       </div>

       {journalMode === 'INPUT_MATERI' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4">Tambah Materi Ajar</h3>
             <form onSubmit={saveMaterial} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Semester</label>
                      <select value={matForm.semester} onChange={e => setMatForm({...matForm, semester: e.target.value as any})} className="w-full border rounded px-3 py-2 text-sm">
                         <option value="1">Ganjil</option>
                         <option value="2">Genap</option>
                      </select>
                   </div>
                   <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Kelas Target</label>
                      <div className="flex flex-wrap gap-2">
                         {CLASSES.map(c => (
                            <label key={c} className={`px-3 py-1.5 rounded text-xs cursor-pointer border select-none transition-colors ${matForm.classes.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                               <input type="checkbox" className="hidden" checked={matForm.classes.includes(c)} onChange={() => handleMatClassToggle(c)} />
                               {c}
                            </label>
                         ))}
                      </div>
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-600 mb-1">Bab (Materi Pokok)</label>
                   <input type="text" value={matForm.chapter} onChange={e => setMatForm({...matForm, chapter: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="Contoh: Bab 1 - Bilangan Bulat" required />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-600 mb-1">Sub Bab</label>
                   {matForm.subChapters.map((sub, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                         <input type="text" value={sub} onChange={e => handleSubChapterChange(idx, e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm" placeholder={`Sub Bab ${idx+1}`} />
                         {matForm.subChapters.length > 1 && (
                            <button type="button" onClick={() => removeSubChapter(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded"><X size={16}/></button>
                         )}
                      </div>
                   ))}
                   <button type="button" onClick={addSubChapter} className="text-xs font-bold text-indigo-600 flex items-center gap-1 mt-1 hover:underline"><Plus size={14}/> Tambah Sub Bab</button>
                </div>
                <div className="flex justify-end pt-4">
                   <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700">Simpan Materi</button>
                </div>
             </form>
          </div>
       )}

       {journalMode === 'INPUT_JURNAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-6">
                   <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">{editingJournalId ? 'Edit Jurnal' : 'Input Jurnal Harian'}</h3>
                   <form onSubmit={saveJournal} className="space-y-4">
                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label>
                         <input type="date" value={jourForm.date} onChange={e => setJourForm({...jourForm, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Jam Ke (Pilih Slot)</label>
                         <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1">
                             {myTeachingSlots.length > 0 ? myTeachingSlots.map((slot, i) => {
                                 const val = `${slot.split('|')[0]}|${slot.split('|')[1]}|${slot.split('|')[2]}`;
                                 const isChecked = jourForm.jamKe.split(',').includes(val);
                                 return (
                                    <label key={i} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-gray-200 rounded">
                                        <input type="checkbox" checked={isChecked} onChange={() => handleJamKeSelection(val)} className="rounded text-indigo-600" />
                                        <span className="font-mono font-bold w-4">{slot.split('|')[1]}</span>
                                        <span className="text-gray-500">{slot.split('|')[0]} ({slot.split('|')[1]}) - {slot.split('|')[2]}</span>
                                    </label>
                                 );
                             }) : <p className="text-xs text-gray-400 italic">Tidak ada jadwal mengajar sesuai data.</p>}
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Kelas</label>
                            <input type="text" value={jourForm.className} readOnly className="w-full bg-gray-100 border rounded px-3 py-2 text-sm font-bold text-gray-700" placeholder="Otomatis" />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Semester</label>
                            <select value={jourForm.semester} onChange={e => setJourForm({...jourForm, semester: e.target.value as any})} className="w-full border rounded px-3 py-2 text-sm">
                               <option value="1">Ganjil</option>
                               <option value="2">Genap</option>
                            </select>
                         </div>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Bab</label>
                         <select value={jourForm.chapter} onChange={e => setJourForm({...jourForm, chapter: e.target.value, subChapter: ''})} className="w-full border rounded px-3 py-2 text-sm" required>
                            <option value="">-- Pilih Bab --</option>
                            {availableChapters.map(m => <option key={m.id} value={m.chapter}>{m.chapter}</option>)}
                         </select>
                      </div>
                      {jourForm.chapter && (
                         <div>
                             <label className="block text-xs font-bold text-gray-600 mb-1">Sub Bab (Bisa &gt; 1)</label>
                             <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1">
                                {availableSubChapters.map((sub, idx) => (
                                    <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 p-1 rounded">
                                        <input 
                                            type="checkbox" 
                                            checked={jourForm.subChapter.split(',').includes(sub)}
                                            onChange={() => handleJournalSubChapterToggle(sub)}
                                            className="rounded text-indigo-600"
                                        />
                                        {sub}
                                    </label>
                                ))}
                             </div>
                         </div>
                      )}
                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Kegiatan Pembelajaran</label>
                         <textarea value={jourForm.activity} onChange={e => setJourForm({...jourForm, activity: e.target.value})} className="w-full border rounded px-3 py-2 text-sm h-20" placeholder="Deskripsi singkat..." />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Catatan / Kejadian</label>
                         <textarea value={jourForm.notes} onChange={e => setJourForm({...jourForm, notes: e.target.value})} className="w-full border rounded px-3 py-2 text-sm h-16" placeholder="Catatan khusus..." />
                      </div>
                      
                      {/* Student Attendance for Journal */}
                      <div className="border-t pt-4">
                          <h4 className="font-bold text-gray-700 text-xs mb-2">Absensi Siswa ({jourForm.className || '-'})</h4>
                          {jourForm.className ? (
                             <div className="max-h-60 overflow-y-auto border rounded bg-white">
                                <table className="w-full text-xs">
                                   <thead className="bg-gray-50 sticky top-0">
                                      <tr>
                                         <th className="px-2 py-1 text-left">Nama</th>
                                         <th className="px-2 py-1 text-center">Status</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y">
                                      {students.filter(s => s.className === jourForm.className).map(s => (
                                         <tr key={s.id}>
                                            <td className="px-2 py-1">{s.name}</td>
                                            <td className="px-2 py-1 flex justify-center gap-1">
                                               {['H','S','I','A','DL'].map(st => (
                                                  <label key={st} className="cursor-pointer px-1 hover:bg-gray-100 rounded">
                                                     <input 
                                                        type="radio" 
                                                        name={`js-${s.id}`} 
                                                        checked={(jourForm.studentAttendance[s.id] || 'H') === st}
                                                        onChange={() => handleStudentAttendanceChange(s.id, st as any)}
                                                     /> <span className={`font-bold ${st==='H'?'text-green-600':st==='A'?'text-red-600':'text-gray-600'}`}>{st}</span>
                                                  </label>
                                               ))}
                                            </td>
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                          ) : <p className="text-xs text-gray-400">Pilih jam/kelas dulu.</p>}
                          
                          {/* Attendance Summary */}
                          {jourForm.className && (
                             <div className="mt-2 flex gap-3 text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded">
                                <span>H: {Object.values(jourForm.studentAttendance).filter(v=>v==='H').length}</span>
                                <span>S: {Object.values(jourForm.studentAttendance).filter(v=>v==='S').length}</span>
                                <span>I: {Object.values(jourForm.studentAttendance).filter(v=>v==='I').length}</span>
                                <span>A: {Object.values(jourForm.studentAttendance).filter(v=>v==='A').length}</span>
                                <span>DL: {Object.values(jourForm.studentAttendance).filter(v=>v==='DL').length}</span>
                             </div>
                          )}
                      </div>

                      <div className="flex gap-2">
                         {editingJournalId && <button type="button" onClick={handleCancelEdit} className="flex-1 py-2 bg-gray-200 rounded font-bold text-sm">Batal</button>}
                         <button type="submit" className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700">
                             {editingJournalId ? 'Simpan Perubahan' : 'Simpan Jurnal'}
                         </button>
                      </div>
                   </form>
                </div>
             </div>

             <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                   <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800">Riwayat Jurnal Mengajar</h3>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                         <thead className="bg-white">
                            <tr>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Tanggal</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Kelas</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Jam Ke</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Bab (Materi)</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Sub Bab</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600 w-48">Kegiatan Pembelajaran</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Catatan</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Absensi Siswa</th>
                               <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-200">
                            {myJournals.map(j => {
                               // Format attendance string: "S: Budi, I: Ani"
                               const absList: string[] = [];
                               if(j.studentAttendance) {
                                  Object.entries(j.studentAttendance).forEach(([sid, status]) => {
                                      if(status !== 'H') {
                                         const sName = students.find(s=>s.id===sid)?.name || 'Siswa';
                                         absList.push(`${status}: ${sName}`);
                                      }
                                  });
                               }
                               const absString = absList.length > 0 ? absList.join(', ') : 'Nihil';

                               return (
                                  <tr key={j.id} className="hover:bg-gray-50">
                                     <td className="px-4 py-3 whitespace-nowrap">{j.date}</td>
                                     <td className="px-4 py-3 font-bold">{j.className}</td>
                                     <td className="px-4 py-3 font-mono">{j.jamKe ? j.jamKe.split(',').map(s=>s.split('|')[1]).join(',') : '-'}</td>
                                     <td className="px-4 py-3">{j.chapter}</td>
                                     <td className="px-4 py-3">{j.subChapter}</td>
                                     <td className="px-4 py-3">{j.activity}</td>
                                     <td className="px-4 py-3 italic text-gray-500">{j.notes || '-'}</td>
                                     <td className="px-4 py-3 text-red-600 font-medium">{absString}</td>
                                     <td className="px-4 py-3 text-center flex justify-center gap-2">
                                        <button onClick={() => handleEditJournalClick(j)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                                        <button onClick={() => onDeleteJournal && onDeleteJournal(j.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                     </td>
                                  </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          </div>
       )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 p-1 gap-1">
        {role !== 'STUDENT' && (
           <button
             onClick={() => setActiveTab('CLASS')}
             className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
               activeTab === 'CLASS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
             }`}
           >
             <School size={18} /> Jadwal Per Kelas
           </button>
        )}
        
        {role !== 'STUDENT' && (
           <button
             onClick={() => setActiveTab('TEACHER')}
             className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
               activeTab === 'TEACHER' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
             }`}
           >
             <User size={18} /> Jadwal Per Guru
           </button>
        )}

        {role === 'STUDENT' && (
           <button
             onClick={() => setActiveTab('CLASS')}
             className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
               activeTab === 'CLASS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
             }`}
           >
             <School size={18} /> Jadwal Kelas
           </button>
        )}

        {role === 'STUDENT' && (
           <button
             onClick={() => setActiveTab('ATTENDANCE')}
             className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
               activeTab === 'ATTENDANCE' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
             }`}
           >
             <ClipboardList size={18} /> Input Kehadiran
           </button>
        )}

        {role === 'TEACHER' && (
           <button
             onClick={() => setActiveTab('JOURNAL')}
             className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
               activeTab === 'JOURNAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
             }`}
           >
             <BookOpen size={18} /> Jurnal Mengajar
           </button>
        )}

        {role === 'TEACHER' && (
           <button
             onClick={() => setActiveTab('MONITORING')}
             className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
               activeTab === 'MONITORING' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
             }`}
           >
             <BarChart3 size={18} /> Monitoring Absensi
           </button>
        )}
      </div>

      {/* Content Area */}
      <div className="bg-gray-50 min-h-[500px]">
        {activeTab === 'CLASS' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             {/* Header Controls */}
             <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
               <div className="flex items-center gap-3">
                 <label className="text-sm font-bold text-gray-700">Pilih Kelas:</label>
                 <select 
                   value={selectedClass} 
                   onChange={(e) => setSelectedClass(e.target.value)}
                   disabled={role === 'STUDENT'}
                   className="border-gray-300 rounded-lg text-sm font-bold px-3 py-2 border shadow-sm focus:ring-2 focus:ring-indigo-500"
                 >
                   {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
               <button 
                 onClick={downloadClassSchedulePDF}
                 className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
               >
                 <FileText size={16} /> Download PDF
               </button>
             </div>

             {/* Schedule Table */}
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-slate-800 text-white">
                   <tr>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-32 border-r border-slate-700">Hari</th>
                     <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-16 border-r border-slate-700">Jam</th>
                     <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-32 border-r border-slate-700">Waktu</th>
                     <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-24 border-r border-slate-700">Kode</th>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-700">Mata Pelajaran</th>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Nama Guru</th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                   {SCHEDULE_DATA.map((daySchedule, dayIdx) => (
                      <React.Fragment key={daySchedule.day}>
                        {daySchedule.rows.map((row, rowIdx) => {
                          const isFirstRow = rowIdx === 0;
                          
                          if (row.activity) {
                            return (
                               <tr key={`${daySchedule.day}-${row.jam}`} className="bg-orange-50/50">
                                  {isFirstRow && (
                                    <td rowSpan={daySchedule.rows.length} className="px-4 py-3 align-top font-bold text-gray-700 border-r border-gray-200 bg-white">
                                      {daySchedule.day}
                                    </td>
                                  )}
                                  <td className="px-4 py-2 text-center text-xs font-bold text-gray-500 border-r border-gray-100">{row.jam}</td>
                                  <td className="px-4 py-2 text-center text-xs font-mono text-gray-500 border-r border-gray-100">{row.waktu}</td>
                                  <td colSpan={3} className="px-4 py-2 text-center text-xs font-bold text-orange-800 uppercase tracking-wide">
                                    {row.activity}
                                  </td>
                               </tr>
                            );
                          }

                          const key = `${daySchedule.day}-${row.jam}-${selectedClass}`;
                          const code = scheduleMap[key];
                          const info = code ? codeToDataMap[code] : null;

                          return (
                            <tr key={`${daySchedule.day}-${row.jam}`} className="hover:bg-slate-50 transition-colors">
                              {isFirstRow && (
                                <td rowSpan={daySchedule.rows.length} className="px-4 py-3 align-top font-bold text-gray-700 border-r border-gray-200 bg-white">
                                  {daySchedule.day}
                                </td>
                              )}
                              <td className="px-4 py-2 text-center text-sm font-medium text-gray-600 border-r border-gray-100">{row.jam}</td>
                              <td className="px-4 py-2 text-center text-xs text-gray-500 font-mono border-r border-gray-100 whitespace-nowrap">{row.waktu}</td>
                              
                              <td className="px-4 py-2 text-center border-r border-gray-100">
                                {code ? (
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${codeColorMap[code]}`}>
                                    {code}
                                  </span>
                                ) : <span className="text-gray-300">-</span>}
                              </td>
                              
                              <td className="px-4 py-2 border-r border-gray-100">
                                {info ? <span className="text-sm font-semibold text-gray-800">{info.subject}</span> : <span className="text-gray-300 text-xs italic">Kosong</span>}
                              </td>
                              
                              <td className="px-4 py-2">
                                {info ? <span className="text-sm text-gray-600">{info.name}</span> : <span className="text-gray-300 text-xs italic">Kosong</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {activeTab === 'TEACHER' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                 <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-gray-700">Pilih Guru:</label>
                    <select 
                      value={selectedTeacherId} 
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      disabled={role === 'TEACHER'}
                      className="border-gray-300 rounded-lg text-sm font-bold px-3 py-2 border shadow-sm focus:ring-2 focus:ring-indigo-500 max-w-xs"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teacherNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                 </div>
                 <button 
                    onClick={downloadTeacherSchedulePDF}
                    disabled={!selectedTeacherId}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                 >
                    <FileText size={16} /> Download PDF
                 </button>
              </div>

              {selectedTeacherId ? (
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                       <thead className="bg-emerald-600 text-white">
                          <tr>
                             <th className="px-4 py-3 text-center text-xs font-bold uppercase w-16 border-r border-emerald-500">No</th>
                             <th className="px-4 py-3 text-center text-xs font-bold uppercase w-24 border-r border-emerald-500">Jam Ke</th>
                             <th className="px-4 py-3 text-center text-xs font-bold uppercase w-32 border-r border-emerald-500">Waktu</th>
                             <th className="px-4 py-3 text-center text-xs font-bold uppercase w-32 border-r border-emerald-500">Hari</th>
                             <th className="px-4 py-3 text-center text-xs font-bold uppercase w-24 border-r border-emerald-500">Kelas</th>
                             <th className="px-4 py-3 text-center text-xs font-bold uppercase w-24 border-r border-emerald-500">Kode</th>
                             <th className="px-4 py-3 text-left text-xs font-bold uppercase">Mata Pelajaran</th>
                          </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-gray-200">
                          {(() => {
                             let counter = 1;
                             const myCodes = teacherData.filter(t => t.name === selectedTeacherId).map(t => t.code);
                             const rows: React.ReactElement[] = [];

                             SCHEDULE_DATA.forEach(day => {
                                day.rows.forEach(row => {
                                   if (row.activity) return;
                                   CLASSES.forEach(cls => {
                                      const key = `${day.day}-${row.jam}-${cls}`;
                                      const scheduledCode = scheduleMap[key];
                                      
                                      if (scheduledCode && myCodes.includes(scheduledCode)) {
                                         const info = codeToDataMap[scheduledCode];
                                         rows.push(
                                            <tr key={`${day.day}-${row.jam}-${cls}`} className="hover:bg-emerald-50">
                                               <td className="px-4 py-3 text-center text-gray-500 font-medium border-r border-gray-100">{counter++}</td>
                                               <td className="px-4 py-3 text-center font-bold text-gray-700 border-r border-gray-100">{row.jam}</td>
                                               <td className="px-4 py-3 text-center text-xs font-mono text-gray-500 border-r border-gray-100">{row.waktu}</td>
                                               <td className="px-4 py-3 text-center font-bold text-emerald-700 border-r border-gray-100">{day.day}</td>
                                               <td className="px-4 py-3 text-center border-r border-gray-100">
                                                  <span className={`px-2 py-1 rounded text-xs font-bold border ${getClassColor(cls)}`}>
                                                     {cls}
                                                  </span>
                                               </td>
                                               <td className="px-4 py-