import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Download, FileText, FileSpreadsheet, Save, Info, Trash2, 
  PenTool, BookOpen, Plus, X, List, Edit2, Filter, ChevronDown,
  User, Users, Calendar
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  TeacherData, AppSettings, CalendarEvent, TeacherLeave, 
  TeachingMaterial, TeachingJournal, Student, UserRole 
} from '../types';
import { CLASSES, SCHEDULE_DATA, COLOR_PALETTE } from '../constants';

interface ClassTeacherScheduleProps {
  teacherData: TeacherData[];
  scheduleMap: Record<string, string>;
  currentUser: string;
  role: UserRole;
  appSettings: AppSettings;
  calendarEvents?: CalendarEvent[];
  teacherLeaves?: TeacherLeave[];
  students?: Student[];
  teachingMaterials?: TeachingMaterial[];
  onAddMaterial?: (material: TeachingMaterial) => void;
  onDeleteMaterial?: (id: string) => void;
  teachingJournals?: TeachingJournal[];
  onAddJournal?: (journal: TeachingJournal) => void;
  onEditJournal?: (journal: TeachingJournal) => void;
  onDeleteJournal?: (id: string) => void;
}

type TabMode = 'CLASS' | 'TEACHER' | 'JOURNAL';
type AttendanceStatus = 'HADIR' | 'TIDAK_HADIR' | 'DINAS_LUAR';
type AttendanceRecord = Record<string, AttendanceStatus>;

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
  const [activeTab, setActiveTab] = useState<TabMode>('CLASS');

  useEffect(() => {
    if (role === 'TEACHER') {
      setActiveTab('TEACHER');
    } else {
      setActiveTab('CLASS');
    }
  }, [role]);

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

  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord>(() => {
    try {
      const saved = localStorage.getItem('attendanceRecords');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [journalMode, setJournalMode] = useState<'INPUT_MATERI' | 'INPUT_JURNAL'>('INPUT_JURNAL');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [journalFilterClass, setJournalFilterClass] = useState<string>(''); 
  const [journalDateFrom, setJournalDateFrom] = useState<string>('');
  const [journalDateTo, setJournalDateTo] = useState<string>('');
  
  // State for Print Date (PDF)
  const [printDate, setPrintDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [monitoringClass, setMonitoringClass] = useState<string>(CLASSES[0]);
  const [isMonitoringDownloadOpen, setIsMonitoringDownloadOpen] = useState(false);
  const monitoringDownloadRef = useRef<HTMLDivElement>(null);

  const [isJournalDownloadOpen, setIsJournalDownloadOpen] = useState(false);
  const journalDownloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (monitoringDownloadRef.current && !monitoringDownloadRef.current.contains(event.target as Node)) {
            setIsMonitoringDownloadOpen(false);
        }
        if (journalDownloadRef.current && !journalDownloadRef.current.contains(event.target as Node)) {
            setIsJournalDownloadOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const teacherNames = useMemo(() => {
    return Array.from(new Set(teacherData.map(t => t.name))).sort();
  }, [teacherData]);

  const mySubjects = useMemo(() => {
    if (!currentUser) return [];
    const entries = teacherData.filter(t => t.name === currentUser);
    return Array.from(new Set(entries.map(t => t.subject)));
  }, [teacherData, currentUser]);

  const [matForm, setMatForm] = useState<{
    semester: '1' | '2';
    classes: string[];
    chapter: string;
    subChapters: string[];
    subject: string;
  }>({
    semester: '2', 
    classes: [],
    chapter: '',
    subChapters: [''],
    subject: ''
  });

  const [jourForm, setJourForm] = useState<{
    date: string;
    semester: '1' | '2';
    jamKe: string;
    className: string;
    subject: string;
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
    subject: '',
    chapter: '',
    subChapter: '',
    activity: '',
    notes: '',
    studentAttendance: {}
  });

  useEffect(() => {
    if (mySubjects.length === 1) {
       if (journalMode === 'INPUT_MATERI' && !matForm.subject) {
          setMatForm(prev => ({ ...prev, subject: mySubjects[0] }));
       }
       if (journalMode === 'INPUT_JURNAL' && !jourForm.subject) {
          setJourForm(prev => ({ ...prev, subject: mySubjects[0] }));
       }
    }
  }, [journalMode, mySubjects, matForm.subject, jourForm.subject]);

  const codeToDataMap = useMemo(() => {
    const map: Record<string, { subject: string, name: string }> = {};
    teacherData.forEach(t => {
      map[t.code] = { subject: t.subject, name: t.name };
    });
    return map;
  }, [teacherData]);

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

  const getDayNameFromDate = (dateString: string) => {
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
    const d = new Date(dateString);
    return days[d.getDay()];
  };

  const downloadClassSchedulePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Jadwal Pelajaran Kelas ${selectedClass}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`SMPN 3 Pacet - Semester ${appSettings.semester} ${appSettings.academicYear}`, 14, 21);

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
    doc.text(`SMPN 3 Pacet - Semester ${appSettings.semester} ${appSettings.academicYear}`, 14, 21);

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

    const pageHeight = doc.internal.pageSize.height;
    const sigY = (doc as any).lastAutoTable.finalY + 20;
    
    if (sigY + 40 > pageHeight) doc.addPage();
    
    const finalSigY = sigY + 40 > pageHeight ? 20 : sigY;
    
    doc.setFontSize(10);
    doc.text(`Mojokerto, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 130, finalSigY);
    
    doc.text('Guru Mata Pelajaran', 20, finalSigY + 10);
    doc.text('Kepala SMPN 3 Pacet', 130, finalSigY + 10);
    
    doc.text(selectedTeacherId, 20, finalSigY + 35);
    doc.text(appSettings?.headmaster || '.........................', 130, finalSigY + 35);
    
    const teacherNip = teacherData.find(t => t.name === selectedTeacherId)?.nip || '................';
    doc.text(`NIP. ${teacherNip}`, 20, finalSigY + 40);
    doc.text(`NIP. ${appSettings?.headmasterNip || '................'}`, 130, finalSigY + 40);

    doc.save(`Jadwal_Guru_${selectedTeacherId.replace(' ', '_')}.pdf`);
  };

  const handleAttendanceChange = (key: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({ ...prev, [key]: status }));
  };
  const resetAttendanceRow = (key: string) => {
     setAttendanceData(prev => { const next = { ...prev }; delete next[key]; return next; });
  };
  
  const renderAttendanceInput = () => {
    const dayName = getDayNameFromDate(attendanceDate);
    const daySchedule = SCHEDULE_DATA.find(d => d.day === dayName);
    const holidayInfo = calendarEvents.find(e => e.date === attendanceDate);
    
    const getRelevantAbsences = () => {
      if (!daySchedule) return [];
      const absentTeachers: { name: string; subject: string; type: string; desc: string }[] = [];
      daySchedule.rows.forEach(row => {
         if (row.activity) return;
         const key = `${dayName}-${row.jam}-${selectedClass}`;
         const code = scheduleMap[key];
         if (code) {
            const tInfo = codeToDataMap[code];
            const teacherIdObj = teacherData.find(t => t.name === tInfo.name);
            if (teacherIdObj) {
               const leave = teacherLeaves.find(l => l.date === attendanceDate && l.teacherId === Number(teacherIdObj.id));
               if (leave && !absentTeachers.some(a => a.name === tInfo.name)) {
                  absentTeachers.push({ name: tInfo.name, subject: tInfo.subject, type: leave.type, desc: leave.description || '-' });
               }
            }
         }
      });
      return absentTeachers;
    };
    const relevantAbsences = getRelevantAbsences();
    
    return (
      <div className="space-y-6 animate-fade-in mt-6 border-t pt-6">
        <h3 className="text-lg font-bold text-gray-800">Input Kehadiran Guru</h3>
        <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
           <div><label className="block text-xs font-bold text-gray-500 mb-1">Tanggal Kehadiran</label><input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500" /></div>
           <div className="flex-1"><div className="text-sm font-bold text-gray-800">Hari: {dayName}</div>{holidayInfo ? (<div className="text-xs text-red-600 font-bold mt-1">Libur Nasional: {holidayInfo.description}</div>) : (<div className="text-xs text-green-600 mt-1">Hari Aktif Sekolah</div>)}</div>
           <button onClick={() => { localStorage.setItem('attendanceRecords', JSON.stringify(attendanceData)); alert('Disimpan!'); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm flex items-center gap-2" disabled={!!holidayInfo}><Save size={16} /> Simpan</button>
        </div>
        {relevantAbsences.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2"><Info size={16} /> Info Guru Berhalangan Hadir</h4><ul className="space-y-1">{relevantAbsences.map((ab, idx) => (<li key={idx} className="text-xs text-yellow-800 bg-white/50 p-2 rounded border border-yellow-100"><strong>{ab.name}</strong> ({ab.subject}) - <span className="uppercase font-bold">{ab.type.replace('_', ' ')}</span>: {ab.desc}</li>))}</ul></div>
        )}
        {daySchedule ? (
           <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-orange-50"><tr><th className="px-4 py-3 text-left font-bold text-gray-600">Jam</th><th className="px-4 py-3 text-left font-bold text-gray-600">Mapel / Guru</th><th className="px-4 py-3 text-center font-bold text-gray-600">Kehadiran Guru</th><th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{daySchedule.rows.map((row, idx) => {
                   if (row.activity) { return (<tr key={idx} className="bg-gray-50"><td className="px-4 py-2 text-center text-xs font-bold text-gray-500">{row.jam}</td><td colSpan={3} className="px-4 py-2 text-center text-xs text-gray-500 italic">{row.activity}</td></tr>); }
                   const key = `${dayName}-${row.jam}-${selectedClass}`; const code = scheduleMap[key]; const info = code ? codeToDataMap[code] : null; const status = attendanceData[key];
                   return (<tr key={idx} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-700">{row.jam} ({row.waktu})</td><td className="px-4 py-3">{info ? (<div><div className="font-bold text-indigo-700">{info.subject}</div><div className="text-xs text-gray-500">{info.name}</div></div>) : <span className="text-gray-400">- Kosong -</span>}</td><td className="px-4 py-3">{holidayInfo ? (<div className="text-center text-xs text-gray-400 font-italic">Libur</div>) : info ? (<div className="flex justify-center gap-4">{['HADIR', 'TIDAK_HADIR', 'DINAS_LUAR'].map((s) => (<label key={s} className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`att-${key}`} checked={status === s} onChange={() => handleAttendanceChange(key, s as AttendanceStatus)} className={`focus:ring-0 ${s === 'HADIR' ? 'text-green-600' : s === 'TIDAK_HADIR' ? 'text-red-600' : 'text-purple-600'}`} /><span className={`text-xs font-bold ${s === 'HADIR' ? 'text-green-700' : s === 'TIDAK_HADIR' ? 'text-red-700' : 'text-purple-700'}`}>{s === 'HADIR' ? 'Hadir' : s === 'TIDAK_HADIR' ? 'Absen' : 'DL'}</span></label>))}</div>) : null}</td><td className="px-4 py-3 text-center">{status && !holidayInfo && (<button onClick={() => resetAttendanceRow(key)} className="text-gray-400 hover:text-red-500 p-1 hover:bg-gray-100 rounded transition-colors" title="Reset / Hapus Input"><Trash2 size={16} /></button>)}</td></tr>);
                 })}</tbody></table></div>
        ) : (<div className="p-8 text-center text-gray-500">Pilih tanggal untuk melihat jadwal.</div>)}
      </div>
    );
  };

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

  const selectedDayName = useMemo(() => getDayNameFromDate(jourForm.date), [jourForm.date]);

  const dailyTeachingSlots = useMemo(() => {
     return myTeachingSlots.filter(slot => slot.startsWith(selectedDayName + '|'));
  }, [myTeachingSlots, selectedDayName]);

  useEffect(() => {
    if (jourForm.jamKe) {
       const firstSlot = jourForm.jamKe.split(',')[0];
       const parts = firstSlot.split('|');
       if (parts.length >= 3) {
          setJourForm(prev => ({ ...prev, className: parts[2] }));
       }
    }
  }, [jourForm.jamKe]);

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

  const handleMatClassToggle = (cls: string) => { setMatForm(prev => ({ ...prev, classes: prev.classes.includes(cls) ? prev.classes.filter(c => c !== cls) : [...prev.classes, cls] })); };
  const handleSubChapterChange = (index: number, val: string) => { const newSubs = [...matForm.subChapters]; newSubs[index] = val; setMatForm(prev => ({ ...prev, subChapters: newSubs })); };
  const addSubChapter = () => setMatForm(prev => ({ ...prev, subChapters: [...prev.subChapters, ''] }));
  const removeSubChapter = (index: number) => { if (matForm.subChapters.length === 1) return; setMatForm(prev => ({ ...prev, subChapters: prev.subChapters.filter((_, i) => i !== index) })); };
  
  const saveMaterial = (e: React.FormEvent) => {
    e.preventDefault(); if (!currentUser || !onAddMaterial) return; if (matForm.classes.length === 0) { alert("Pilih minimal satu kelas!"); return; }
    onAddMaterial({ id: Date.now().toString(), teacherName: currentUser, subject: matForm.subject, semester: matForm.semester, classes: matForm.classes, chapter: matForm.chapter, subChapters: matForm.subChapters.filter(s => s.trim() !== '') });
    setMatForm({ semester: '2', classes: [], chapter: '', subChapters: [''], subject: matForm.subject }); alert("Materi berhasil ditambahkan!");
  };

  const availableChapters = useMemo(() => {
    if (!currentUser) return [];
    return teachingMaterials.filter(m => m.teacherName === currentUser && m.semester === jourForm.semester && m.classes.includes(jourForm.className) && (!jourForm.subject || m.subject === jourForm.subject));
  }, [teachingMaterials, currentUser, jourForm.semester, jourForm.className, jourForm.subject]);

  const availableSubChapters = useMemo(() => { const selectedMat = availableChapters.find(m => m.chapter === jourForm.chapter); return selectedMat ? selectedMat.subChapters : []; }, [availableChapters, jourForm.chapter]);

  const saveJournal = (e: React.FormEvent) => {
    e.preventDefault(); if (!currentUser) return;
    const journalData: TeachingJournal = { id: editingJournalId || Date.now().toString(), teacherName: currentUser, ...jourForm };
    if (editingJournalId && onEditJournal) { onEditJournal(journalData); setEditingJournalId(null); alert("Perubahan jurnal berhasil disimpan!"); } else if (onAddJournal) { onAddJournal(journalData); alert("Jurnal berhasil disimpan!"); }
    setJourForm({ date: new Date().toISOString().split('T')[0], semester: '2', jamKe: '', className: '', subject: jourForm.subject, chapter: '', subChapter: '', activity: '', notes: '', studentAttendance: {} });
  };

  const handleEditJournalClick = (journal: TeachingJournal) => {
    setEditingJournalId(journal.id);
    setJourForm({ date: journal.date, semester: journal.semester, jamKe: journal.jamKe, className: journal.className, subject: journal.subject || '', chapter: journal.chapter, subChapter: journal.subChapter, activity: journal.activity, notes: journal.notes, studentAttendance: journal.studentAttendance || {} });
    setJournalMode('INPUT_JURNAL');
  };

  const handleCancelEdit = () => { setEditingJournalId(null); setJourForm({ date: new Date().toISOString().split('T')[0], semester: '2', jamKe: '', className: '', subject: jourForm.subject, chapter: '', subChapter: '', activity: '', notes: '', studentAttendance: {} }); setJournalMode('INPUT_JURNAL'); };
  const myJournals = useMemo(() => { let journals = teachingJournals.filter(j => j.teacherName === currentUser); if (journalFilterClass) { journals = journals.filter(j => j.className === journalFilterClass); } if (journalDateFrom) { journals = journals.filter(j => j.date >= journalDateFrom); } if (journalDateTo) { journals = journals.filter(j => j.date <= journalDateTo); } return journals.sort((a, b) => b.date.localeCompare(a.date)); }, [teachingJournals, currentUser, journalFilterClass, journalDateFrom, journalDateTo]);
  const handleStudentAttendanceChange = (studentId: string, status: 'H' | 'S' | 'I' | 'A' | 'DL') => { setJourForm(prev => ({ ...prev, studentAttendance: { ...prev.studentAttendance, [studentId]: status } })); };
  
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
          
          // Auto-link Subject logic
          let newSubject = prev.subject;
          if (currentSelected.length > 0) {
             const firstSlot = currentSelected[0];
             const parts = firstSlot.split('|');
             if(parts.length >= 3) {
                 const [day, jam, cls] = parts;
                 const key = `${day}-${jam}-${cls}`;
                 const code = scheduleMap[key];
                 if (code && codeToDataMap[code]) {
                    newSubject = codeToDataMap[code].subject;
                 }
             }
          }
          return { ...prev, jamKe: currentSelected.join(','), subject: newSubject };
      });
  };

  const handleJournalSubChapterToggle = (sub: string) => { setJourForm(prev => { let current = prev.subChapter ? prev.subChapter.split(',') : []; current = current.map(s => s.trim()).filter(s => s !== ''); if (current.includes(sub)) current = current.filter(s => s !== sub); else current.push(sub); return { ...prev, subChapter: current.join(',') }; }); };

  const downloadJournalHistoryPDF = (format: 'a4' | 'f4') => {
    const formatSize = format === 'a4' ? 'a4' : [215, 330]; 
    const doc = new jsPDF('l', 'mm', formatSize as any);
    doc.setFontSize(14);
    doc.text(`Riwayat Jurnal Mengajar - ${currentUser}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Semester ${jourForm.semester} Tahun Ajaran ${appSettings?.academicYear || ''}`, 14, 21);

    const tableBody = myJournals.map((j, idx) => {
        const absList: string[] = [];
        if (j.studentAttendance) {
            Object.entries(j.studentAttendance).forEach(([sid, status]) => {
                if (status !== 'H') {
                    const sName = students.find(s => s.id === sid)?.name || 'Siswa';
                    absList.push(`${status}: ${sName}`);
                }
            });
        }
        const absString = absList.length > 0 ? absList.join(', ') : 'Nihil';

        return [
            idx + 1,
            j.date,
            j.className,
            j.jamKe ? j.jamKe.split(',').map(s => s.split('|')[1]).join(',') : '-',
            j.subject || '-',
            j.chapter,
            j.subChapter,
            j.activity,
            j.notes || '-',
            absString
        ];
    });

    autoTable(doc, {
        startY: 25,
        head: [['No', 'Tanggal', 'Kelas', 'Jam', 'Mapel', 'Bab', 'Sub Bab', 'Kegiatan', 'Catatan', 'Absensi']],
        body: tableBody as any,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8, cellPadding: 1 },
        columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 22 },
            2: { cellWidth: 15 },
            3: { cellWidth: 15 },
            4: { cellWidth: 25 },
            5: { cellWidth: 20 },
            6: { cellWidth: 20 },
            7: { cellWidth: 'auto' }, 
            8: { cellWidth: 30 },
            9: { cellWidth: 30 }
        }
    });

    const pageHeight = doc.internal.pageSize.height;
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Ensure space for signature block (approx 40mm)
    if (finalY + 40 > pageHeight) {
        doc.addPage();
        finalY = 20;
    }

    // Use selected printDate state instead of new Date()
    const dateStr = new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    doc.setFontSize(10);

    // Right Side: Teacher Signature
    doc.text(`Mojokerto, ${dateStr}`, 200, finalY);
    doc.text('Guru Mata Pelajaran', 200, finalY + 5);
    doc.text(currentUser || '....................', 200, finalY + 30);
    
    const myData = teacherData.find(t => t.name === currentUser);
    if(myData && myData.nip) {
        doc.text(`NIP. ${myData.nip}`, 200, finalY + 35);
    } else {
        doc.text(`NIP. -`, 200, finalY + 35);
    }

    // Left Side: Headmaster Signature
    doc.text('Mengetahui,', 20, finalY);
    doc.text('Kepala SMPN 3 Pacet', 20, finalY + 5);
    doc.text(appSettings.headmaster || '.........................', 20, finalY + 30);
    doc.text(`NIP. ${appSettings.headmasterNip || '................'}`, 20, finalY + 35);

    doc.save(`Jurnal_Mengajar_${currentUser?.replace(' ', '_')}_${format.toUpperCase()}.pdf`);
    setIsJournalDownloadOpen(false);
  };

  const downloadJournalHistoryExcel = () => {
    const data = myJournals.map((j, idx) => {
        const absList: string[] = [];
        if (j.studentAttendance) {
            Object.entries(j.studentAttendance).forEach(([sid, status]) => {
                if (status !== 'H') {
                    const sName = students.find(s => s.id === sid)?.name || 'Siswa';
                    absList.push(`${status}: ${sName}`);
                }
            });
        }
        const absString = absList.length > 0 ? absList.join(', ') : 'Nihil';
        return {
            'No': idx + 1,
            'Tanggal': j.date,
            'Kelas': j.className,
            'Jam Ke': j.jamKe ? j.jamKe.split(',').map(s => s.split('|')[1]).join(',') : '-',
            'Mata Pelajaran': j.subject || '-',
            'Bab': j.chapter,
            'Sub Bab': j.subChapter,
            'Kegiatan': j.activity,
            'Catatan': j.notes || '-',
            'Absensi': absString
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurnal Mengajar");
    ws['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 25 },
        { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 30 }
    ];
    XLSX.writeFile(wb, `Jurnal_Mengajar_${currentUser?.replace(' ', '_')}.xlsx`);
    setIsJournalDownloadOpen(false);
  };

  const renderAttendanceMonitoring = () => {
    const classJournals = teachingJournals.filter(j => j.className === monitoringClass && j.teacherName === currentUser);
    const classStudents = students.filter(s => s.className === monitoringClass);
    
    const studentStats = classStudents.map(student => {
        let sakit = 0, izin = 0, alpha = 0, dl = 0, hadir = 0;
        classJournals.forEach(j => {
            const status = j.studentAttendance?.[student.id] || 'H';
            if (status === 'S') sakit++;
            else if (status === 'I') izin++;
            else if (status === 'A') alpha++;
            else if (status === 'DL') dl++;
            else hadir++;
        });
        const total = sakit + izin + alpha + dl + hadir;
        return { ...student, sakit, izin, alpha, dl, hadir, total };
    });

    const downloadMonitoring = () => {
        const data = studentStats.map((s, i) => ({
            'No': i + 1,
            'Nama Siswa': s.name,
            'Kelas': s.className,
            'Hadir': s.hadir,
            'Sakit': s.sakit,
            'Izin': s.izin,
            'Alpha': s.alpha,
            'Dispensasi': s.dl,
            'Total': s.total,
            'Persentase': s.total > 0 ? `${Math.round((s.hadir / s.total) * 100)}%` : '0%'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Rekap_Absensi_${monitoringClass}`);
        ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
        XLSX.writeFile(wb, `Rekap_Absensi_Siswa_${monitoringClass}.xlsx`);
        setIsMonitoringDownloadOpen(false);
    };

    return (
        <div className="space-y-6 animate-fade-in mt-6 border-t pt-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Rekapitulasi Kehadiran Siswa</h3>
                        <p className="text-sm text-gray-500">Berdasarkan jurnal mengajar Anda di kelas {monitoringClass}.</p>
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={monitoringClass} 
                            onChange={(e) => setMonitoringClass(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 bg-white"
                        >
                            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="relative" ref={monitoringDownloadRef}>
                             <button 
                                onClick={() => setIsMonitoringDownloadOpen(!isMonitoringDownloadOpen)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow hover:bg-indigo-700 flex items-center gap-2"
                             >
                                <Download size={16} /> Download Rekap
                             </button>
                             {isMonitoringDownloadOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden z-20 animate-fade-in">
                                    <button onClick={downloadMonitoring} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                        <FileSpreadsheet size={16} className="text-green-600"/> Excel
                                    </button>
                                </div>
                             )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 w-10">No</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Nama Siswa</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600">Hadir</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600 text-blue-600">Sakit</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600 text-orange-600">Izin</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600 text-red-600">Alpha</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600 text-purple-600">Disp</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600">Total</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {studentStats.length > 0 ? studentStats.map((s, idx) => (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-2 font-medium text-gray-800">{s.name}</td>
                                    <td className="px-4 py-2 text-center font-bold text-gray-700">{s.hadir}</td>
                                    <td className="px-4 py-2 text-center text-blue-600">{s.sakit}</td>
                                    <td className="px-4 py-2 text-center text-orange-600">{s.izin}</td>
                                    <td className="px-4 py-2 text-center text-red-600">{s.alpha}</td>
                                    <td className="px-4 py-2 text-center text-purple-600">{s.dl}</td>
                                    <td className="px-4 py-2 text-center font-bold">{s.total}</td>
                                    <td className="px-4 py-2 text-center font-bold text-indigo-600">
                                        {s.total > 0 ? Math.round((s.hadir / s.total) * 100) : 0}%
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                                        Belum ada data siswa atau jurnal untuk kelas ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                      <label className="block text-xs font-bold text-gray-600 mb-1">Mata Pelajaran</label>
                      <select 
                        value={matForm.subject} 
                        onChange={e => setMatForm({...matForm, subject: e.target.value})} 
                        className="w-full border rounded px-3 py-2 text-sm"
                        required
                      >
                         <option value="">-- Pilih Mapel --</option>
                         {mySubjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Semester</label>
                      <select value={matForm.semester} onChange={e => setMatForm({...matForm, semester: e.target.value as any})} className="w-full border rounded px-3 py-2 text-sm">
                         <option value="1">Ganjil</option>
                         <option value="2">Genap</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Bab (Materi Pokok)</label>
                      <input type="text" value={matForm.chapter} onChange={e => setMatForm({...matForm, chapter: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="Contoh: Bab 1" required />
                   </div>
                </div>
                <div>
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

             <div className="mt-8 border-t pt-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <List size={20} className="text-indigo-600"/> Daftar Materi Tersimpan
                </h4>
                <div className="overflow-x-auto border rounded-lg">
                   <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                         <tr>
                            <th className="px-4 py-3 text-left font-bold text-gray-600 w-12">No</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Mata Pelajaran</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600 w-24">Smt</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Kelas</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Bab</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600">Sub Bab</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600 w-20">Aksi</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                         {teachingMaterials.filter(m => m.teacherName === currentUser).length > 0 ? (
                            teachingMaterials.filter(m => m.teacherName === currentUser).map((m, i) => (
                               <tr key={m.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                                  <td className="px-4 py-3 font-medium text-gray-900">{m.subject}</td>
                                  <td className="px-4 py-3 text-center">{m.semester}</td>
                                  <td className="px-4 py-3">
                                     <div className="flex flex-wrap gap-1">
                                        {m.classes.map(c => (
                                           <span key={c} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">{c}</span>
                                        ))}
                                     </div>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-indigo-700">{m.chapter}</td>
                                  <td className="px-4 py-3 text-xs text-gray-600">
                                     <ul className="list-disc list-inside">
                                        {m.subChapters.map((sub, idx) => <li key={idx}>{sub}</li>)}
                                     </ul>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                     {onDeleteMaterial && (
                                        <button 
                                           onClick={() => onDeleteMaterial(m.id)}
                                           className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                           title="Hapus Materi"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                     )}
                                  </td>
                               </tr>
                            ))
                         ) : (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 italic">Belum ada materi.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
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
                         <input 
                           type="date" 
                           value={jourForm.date} 
                           onChange={e => setJourForm({...jourForm, date: e.target.value, jamKe: '', className: '', subject: '', chapter: '', subChapter: ''})} 
                           className="w-full border rounded px-3 py-2 text-sm" 
                           required 
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Jam Ke (Pilih Slot {selectedDayName})</label>
                         <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1">
                             {dailyTeachingSlots.length > 0 ? dailyTeachingSlots.map((slot, i) => {
                                 const val = `${slot.split('|')[0]}|${slot.split('|')[1]}|${slot.split('|')[2]}`;
                                 const isChecked = jourForm.jamKe.split(',').includes(val);
                                 return (
                                    <label key={i} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-gray-200 rounded">
                                        <input type="checkbox" checked={isChecked} onChange={() => handleJamKeSelection(val)} className="rounded text-indigo-600" />
                                        <span className="font-mono font-bold w-4">{slot.split('|')[1]}</span>
                                        <span className="text-gray-500">{slot.split('|')[0]} ({slot.split('|')[1]}) - {slot.split('|')[2]}</span>
                                    </label>
                                 );
                             }) : <p className="text-xs text-gray-400 italic">Tidak ada jadwal mengajar pada hari {selectedDayName} atau belum ada data jadwal.</p>}
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
                          <label className="block text-xs font-bold text-gray-600 mb-1">Mata Pelajaran (Otomatis)</label>
                          <select 
                            value={jourForm.subject} 
                            onChange={e => setJourForm({...jourForm, subject: e.target.value, chapter: '', subChapter: ''})} 
                            className="w-full border rounded px-3 py-2 text-sm"
                            required
                          >
                             <option value="">-- Pilih Mapel --</option>
                             {mySubjects.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>

                      <div>
                         <label className="block text-xs font-bold text-gray-600 mb-1">Bab</label>
                         <select value={jourForm.chapter} onChange={e => setJourForm({...jourForm, chapter: e.target.value, subChapter: ''})} className="w-full border rounded px-3 py-2 text-sm" required disabled={!jourForm.subject}>
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
                      
                      <div className="flex flex-wrap items-center gap-2">
                         <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm">
                            <Filter size={14} className="text-gray-400"/>
                            <select 
                               value={journalFilterClass} 
                               onChange={(e) => setJournalFilterClass(e.target.value)}
                               className="text-xs font-bold text-gray-700 border-none outline-none bg-transparent"
                            >
                               <option value="">Semua Kelas</option>
                               {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>

                         <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm">
                            <span className="text-[10px] text-gray-500 font-bold">Dari:</span>
                            <input 
                              type="date" 
                              value={journalDateFrom} 
                              onChange={(e) => setJournalDateFrom(e.target.value)}
                              className="text-xs font-bold text-gray-700 border-none outline-none bg-transparent w-24"
                            />
                         </div>
                         <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm">
                            <span className="text-[10px] text-gray-500 font-bold">Sampai:</span>
                            <input 
                              type="date" 
                              value={journalDateTo} 
                              onChange={(e) => setJournalDateTo(e.target.value)}
                              className="text-xs font-bold text-gray-700 border-none outline-none bg-transparent w-24"
                            />
                         </div>

                         <div className="relative" ref={journalDownloadRef}>
                           <button 
                              onClick={() => setIsJournalDownloadOpen(!isJournalDownloadOpen)}
                              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50"
                           >
                              <Download size={16} /> <span className="hidden sm:inline">Download</span>
                              <ChevronDown size={14} />
                           </button>
                           {isJournalDownloadOpen && (
                              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden z-20 animate-fade-in">
                                 {/* Date Picker for PDF Signature */}
                                 <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Tanggal Cetak</label>
                                    <input
                                      type="date"
                                      value={printDate}
                                      onChange={(e) => setPrintDate(e.target.value)}
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                                    />
                                 </div>

                                 <button 
                                   onClick={() => downloadJournalHistoryPDF('a4')}
                                   className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 border-b border-gray-100"
                                 >
                                    <FileText size={16} className="text-red-500"/> PDF (A4)
                                 </button>
                                 <button 
                                   onClick={() => downloadJournalHistoryPDF('f4')}
                                   className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 border-b border-gray-100"
                                 >
                                    <FileText size={16} className="text-red-500"/> PDF (F4)
                                 </button>
                                 <button 
                                   onClick={downloadJournalHistoryExcel}
                                   className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                 >
                                    <FileSpreadsheet size={16} className="text-green-600"/> Excel
                                 </button>
                              </div>
                           )}
                         </div>
                      </div>

                   </div>
                   <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                         <thead className="bg-white">
                            <tr>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Tanggal</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Kelas</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Jam Ke</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Mapel</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Bab</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Sub Bab</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600 w-48">Kegiatan</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Catatan</th>
                               <th className="px-4 py-3 text-left font-bold text-gray-600">Absensi</th>
                               <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-200">
                            {myJournals.map(j => {
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
                                     <td className="px-4 py-3 font-medium">{j.subject || '-'}</td>
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
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Role-based Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex overflow-x-auto">
        <button
          onClick={() => setActiveTab('CLASS')}
          className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'CLASS' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users size={18} />
            Jadwal Kelas
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('TEACHER')}
          className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'TEACHER' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <User size={18} />
            Jadwal Guru
          </div>
        </button>

        {role === 'TEACHER' && (
          <button
            onClick={() => setActiveTab('JOURNAL')}
            className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'JOURNAL' 
                ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <PenTool size={18} />
              Jurnal Mengajar
            </div>
          </button>
        )}
      </div>

      {/* --- CLASS SCHEDULE VIEW --- */}
      {activeTab === 'CLASS' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           {/* Header with Class Selector & Download */}
           <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                 <div className="bg-white p-2 rounded-full shadow-sm border border-gray-200">
                    <Users className="text-indigo-600" size={24} />
                 </div>
                 <div>
                    <h2 className="text-lg font-bold text-gray-800">Jadwal Pelajaran Kelas</h2>
                    <p className="text-xs text-gray-500">Pilih kelas untuk melihat jadwal.</p>
                 </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <select 
                   value={selectedClass} 
                   onChange={(e) => setSelectedClass(e.target.value)}
                   className="bg-white border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                 >
                    {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                 </select>
                 <button 
                   onClick={downloadClassSchedulePDF}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                 >
                    <Download size={18} /> PDF
                 </button>
              </div>
           </div>

           {/* Schedule Table for Class */}
           <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50">
                    <tr>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Jam</th>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Waktu</th>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mata Pelajaran</th>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Guru Pengampu</th>
                    </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                    {SCHEDULE_DATA.map(day => (
                       <React.Fragment key={day.day}>
                          <tr className="bg-indigo-50/50">
                             <td colSpan={4} className="px-6 py-2 text-sm font-bold text-indigo-700 border-t border-indigo-100 mt-4">
                                {day.day}
                             </td>
                          </tr>
                          {day.rows.map((row, idx) => {
                             if (row.activity) {
                                return (
                                   <tr key={`${day.day}-${idx}`} className="bg-orange-50">
                                      <td className="px-6 py-3 text-center text-xs font-bold text-gray-500">{row.jam}</td>
                                      <td className="px-6 py-3 text-xs text-gray-500 font-mono">{row.waktu}</td>
                                      <td colSpan={2} className="px-6 py-3 text-sm font-bold text-orange-800 text-center italic">
                                         {row.activity}
                                      </td>
                                   </tr>
                                );
                             }
                             const key = `${day.day}-${row.jam}-${selectedClass}`;
                             const code = scheduleMap[key];
                             const info = code ? codeToDataMap[code] : null;
                             const colorClass = code ? codeColorMap[code] || 'bg-gray-100' : '';

                             return (
                                <tr key={`${day.day}-${idx}`} className="hover:bg-gray-50">
                                   <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-center">{row.jam}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">{row.waktu}</td>
                                   <td className="px-6 py-4 whitespace-nowrap">
                                      {info ? (
                                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                                            {info.subject}
                                         </span>
                                      ) : <span className="text-gray-400 text-sm italic">- Kosong -</span>}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                      {info ? info.name : '-'}
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

      {/* --- TEACHER SCHEDULE VIEW --- */}
      {activeTab === 'TEACHER' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
           <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                 <div className="bg-white p-2 rounded-full shadow-sm border border-gray-200">
                    <User className="text-emerald-600" size={24} />
                 </div>
                 <div>
                    <h2 className="text-lg font-bold text-gray-800">Jadwal Mengajar Guru</h2>
                    <p className="text-xs text-gray-500">Lihat jadwal spesifik per guru.</p>
                 </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <select 
                   value={selectedTeacherId} 
                   onChange={(e) => setSelectedTeacherId(e.target.value)}
                   className="bg-white border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm max-w-[200px]"
                 >
                    {role === 'TEACHER' ? (
                       <option value={currentUser}>{currentUser}</option>
                    ) : (
                       <>
                         <option value="">-- Pilih Guru --</option>
                         {teacherNames.map(name => <option key={name} value={name}>{name}</option>)}
                       </>
                    )}
                 </select>
                 <button 
                   onClick={downloadTeacherSchedulePDF}
                   disabled={!selectedTeacherId}
                   className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                 >
                    <Download size={18} /> PDF
                 </button>
              </div>
           </div>

           {selectedTeacherId ? (
              <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                       <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Hari</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Jam</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Waktu</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kelas</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mata Pelajaran</th>
                       </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                       {SCHEDULE_DATA.map(day => {
                          const myRows = day.rows.map(row => {
                             if(row.activity) return null;
                             let foundClass = null;
                             let foundCode = null;
                             
                             CLASSES.forEach(cls => {
                                const key = `${day.day}-${row.jam}-${cls}`;
                                const code = scheduleMap[key];
                                if(code) {
                                   const info = codeToDataMap[code];
                                   if(info && info.name === selectedTeacherId) {
                                      foundClass = cls;
                                      foundCode = code;
                                   }
                                }
                             });

                             if(foundClass) {
                                return { ...row, className: foundClass, code: foundCode };
                             }
                             return null;
                          }).filter(Boolean);

                          if(myRows.length === 0) return null;

                          return (
                             <React.Fragment key={day.day}>
                                {myRows.map((row: any, idx) => {
                                   const info = codeToDataMap[row.code];
                                   return (
                                      <tr key={`${day.day}-${row.jam}`} className="hover:bg-gray-50">
                                         {idx === 0 && (
                                            <td rowSpan={myRows.length} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 bg-gray-50/50 border-r border-gray-100 align-top">
                                               {day.day}
                                            </td>
                                         )}
                                         <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-center">{row.jam}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">{row.waktu}</td>
                                         <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-indigo-100 text-indigo-800">
                                               {row.className}
                                            </span>
                                         </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {info?.subject}
                                         </td>
                                      </tr>
                                   );
                                })}
                             </React.Fragment>
                          );
                       })}
                       
                       {/* If no schedule found */}
                       {SCHEDULE_DATA.every(day => {
                          return day.rows.every(row => {
                             if(row.activity) return true;
                             return !CLASSES.some(cls => {
                                const key = `${day.day}-${row.jam}-${cls}`;
                                const code = scheduleMap[key];
                                return code && codeToDataMap[code]?.name === selectedTeacherId;
                             });
                          });
                       }) && (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">Tidak ada jadwal mengajar ditemukan.</td></tr>
                       )}
                    </tbody>
                 </table>
                 
                 {/* Attendance Input (Only for Teachers viewing their own schedule or Admin) */}
                 {(role === 'TEACHER' || role === 'ADMIN') && selectedTeacherId && (
                    renderAttendanceInput()
                 )}

                 {/* Monitoring (Only for Teachers viewing their own schedule or Admin) */}
                 {(role === 'TEACHER' && selectedTeacherId === currentUser) && (
                    renderAttendanceMonitoring()
                 )}

              </div>
           ) : (
              <div className="p-8 text-center text-gray-500">Pilih nama guru untuk melihat jadwal.</div>
           )}
        </div>
      )}

      {/* --- JOURNAL VIEW --- */}
      {activeTab === 'JOURNAL' && role === 'TEACHER' && (
         renderJournalTab()
      )}

    </div>
  );
};

export default ClassTeacherSchedule;