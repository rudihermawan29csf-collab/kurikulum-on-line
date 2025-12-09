
import React, { useState, useMemo, useEffect } from 'react';
import { TeacherData, UserRole, CalendarEvent, TeacherLeave, TeachingMaterial, TeachingJournal, Student } from '../types';
import { SCHEDULE_DATA, CLASSES, COLOR_PALETTE } from '../constants';
import { User, School, CalendarClock, Table, Download, FileText, ClipboardList, CheckCircle, XCircle, Clock, Save, Info, BookOpen, PenTool, Plus, Trash2, ChevronDown, BarChart3, Edit2, X, Image as ImageIcon, ZoomIn, CheckSquare } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClassTeacherScheduleProps {
  teacherData: TeacherData[];
  scheduleMap: Record<string, string>;
  currentUser?: string;
  role?: UserRole;
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

interface TeacherScheduleRow {
  no: number;
  day: string;
  jam: string;
  waktu: string;
  cls: string;
  code: string;
  subject: string;
}

const ClassTeacherSchedule: React.FC<ClassTeacherScheduleProps> = ({ 
  teacherData, 
  scheduleMap, 
  currentUser, 
  role,
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Monitoring State
  const [monitoringClass, setMonitoringClass] = useState<string>(CLASSES[0]);

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
    documentationPhoto?: string;
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
    const uniqueNames: string[] = [];
    teacherData.forEach(t => {
       if(!uniqueNames.includes(t.name)) uniqueNames.push(t.name);
    });
    return uniqueNames.sort();
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

  // --- ATTENDANCE HELPERS ---
  const getDayNameFromDate = (dateString: string) => {
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
    const d = new Date(dateString);
    return days[d.getDay()];
  };

  const handleAttendanceChange = (key: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [key]: status
    }));
  };

  const saveAttendance = () => {
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceData));
    alert('Data kehadiran berhasil disimpan!');
  };
  
  const resetAttendanceRow = (keyPrefix: string) => {
    // Finds all keys starting with prefix (date-jam-class) and sets to null
    // But our structure is one key per row? No, key is per cell or per row?
    // In renderAttendanceInput, key is `${attendanceDate}-${row.jam}-${selectedClass}`
    // So simple delete or set to null
    setAttendanceData(prev => {
        const newState = { ...prev };
        delete newState[keyPrefix];
        return newState;
    });
  };

  const isHoliday = useMemo(() => {
    return calendarEvents.find(e => e.date === attendanceDate);
  }, [attendanceDate, calendarEvents]);

  // --- JOURNAL HANDLERS ---

  const myTeachingSlots = useMemo(() => {
    if (!currentUser || role !== 'TEACHER') return [];
    const myCodes = teacherData.filter(t => t.name === currentUser).map(t => t.code);
    
    const slots: { day: string; jam: string; time: string; cls: string; code: string }[] = [];
    
    SCHEDULE_DATA.forEach(day => {
      day.rows.forEach(row => {
        if (row.activity) return;
        CLASSES.forEach(cls => {
          const key = `${day.day}-${row.jam}-${cls}`;
          const code = scheduleMap[key];
          if (code && myCodes.includes(code)) {
             slots.push({
               day: day.day,
               jam: row.jam,
               time: row.waktu,
               cls: cls,
               code: code
             });
          }
        });
      });
    });
    return slots;
  }, [currentUser, role, teacherData, scheduleMap]);

  useEffect(() => {
    if (jourForm.jamKe) {
       const firstSlot = jourForm.jamKe.split(',')[0];
       const [day, jam, cls] = firstSlot.split('|');
       if (cls) {
         setJourForm(prev => ({ ...prev, className: cls }));
       }
    }
  }, [jourForm.jamKe]);

  useEffect(() => {
     if (jourForm.className && students.length > 0) {
        const classStudents = students.filter(s => s.className === jourForm.className);
        
        setJourForm(prev => {
            const newAttendance = { ...prev.studentAttendance };
            classStudents.forEach(s => {
                if (!newAttendance[s.id]) {
                    newAttendance[s.id] = 'H';
                }
            });
            return { ...prev, studentAttendance: newAttendance };
        });
     }
  }, [jourForm.className, students]);

  const handleMatClassToggle = (cls: string) => {
    setMatForm(prev => ({
      ...prev,
      classes: prev.classes.includes(cls) 
        ? prev.classes.filter(c => c !== cls)
        : [...prev.classes, cls]
    }));
  };

  const handleSubChapterChange = (index: number, val: string) => {
    const newSubs = [...matForm.subChapters];
    newSubs[index] = val;
    setMatForm(prev => ({ ...prev, subChapters: newSubs }));
  };

  const addSubChapter = () => {
    setMatForm(prev => ({ ...prev, subChapters: [...prev.subChapters, ''] }));
  };

  const removeSubChapter = (index: number) => {
    if (matForm.subChapters.length === 1) return;
    setMatForm(prev => ({
      ...prev,
      subChapters: prev.subChapters.filter((_, i) => i !== index)
    }));
  };

  const saveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onAddMaterial) return;
    if (matForm.classes.length === 0) {
      alert("Pilih minimal satu kelas!");
      return;
    }
    
    onAddMaterial({
      id: Date.now().toString(),
      teacherName: currentUser,
      semester: matForm.semester,
      classes: matForm.classes,
      chapter: matForm.chapter,
      subChapters: matForm.subChapters.filter(s => s.trim() !== '')
    });
    
    setMatForm({
      semester: '2',
      classes: [],
      chapter: '',
      subChapters: ['']
    });
    alert("Materi berhasil ditambahkan!");
  };

  const availableChapters = useMemo(() => {
    if (!currentUser) return [];
    return teachingMaterials.filter(m => 
      m.teacherName === currentUser && 
      m.semester === jourForm.semester &&
      m.classes.includes(jourForm.className)
    );
  }, [teachingMaterials, currentUser, jourForm.semester, jourForm.className]);

  const availableSubChapters = useMemo(() => {
    const selectedMat = availableChapters.find(m => m.chapter === jourForm.chapter);
    return selectedMat ? selectedMat.subChapters : [];
  }, [availableChapters, jourForm.chapter]);

  const saveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (editingJournalId && onEditJournal) {
      onEditJournal({
        id: editingJournalId,
        teacherName: currentUser,
        ...jourForm
      });
      setEditingJournalId(null);
      alert("Perubahan jurnal berhasil disimpan!");
    } else if (onAddJournal) {
      onAddJournal({
        id: Date.now().toString(),
        teacherName: currentUser,
        ...jourForm
      });
      alert("Jurnal berhasil disimpan!");
    }

    setJourForm({
      date: new Date().toISOString().split('T')[0],
      semester: '2',
      jamKe: '',
      className: '',
      chapter: '',
      subChapter: '',
      activity: '',
      notes: '',
      studentAttendance: {},
      documentationPhoto: ''
    });
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
      studentAttendance: journal.studentAttendance || {},
      documentationPhoto: journal.documentationPhoto || ''
    });
    setJournalMode('INPUT_JURNAL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      studentAttendance: {},
      documentationPhoto: ''
    });
  };

  const myJournals = useMemo(() => {
     return teachingJournals.filter(j => j.teacherName === currentUser).sort((a,b) => b.date.localeCompare(a.date));
  }, [teachingJournals, currentUser]);

  const handleStudentAttendanceChange = (studentId: string, status: 'H' | 'S' | 'I' | 'A' | 'DL') => {
      setJourForm(prev => ({
          ...prev,
          studentAttendance: {
              ...prev.studentAttendance,
              [studentId]: status
          }
      }));
  };

  const handleJamKeSelection = (slotVal: string) => {
      setJourForm(prev => {
          let currentSelected = prev.jamKe ? prev.jamKe.split(',') : [];
          if (currentSelected.includes(slotVal)) {
              currentSelected = currentSelected.filter(s => s !== slotVal);
          } else {
              if (currentSelected.length > 0) {
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
          
          if (current.includes(sub)) {
              current = current.filter(s => s !== sub);
          } else {
              current.push(sub);
          }
          return { ...prev, subChapter: current.join(',') };
      });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { 
        alert("Ukuran foto terlalu besar (Max 500KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setJourForm(prev => ({ ...prev, documentationPhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
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

    if (tableBody.length === 0) {
        doc.text("Belum ada jadwal mengajar.", 14, 30);
    } else {
        autoTable(doc, {
            startY: 30,
            head: [['No', 'Jam Ke', 'Waktu', 'Hari', 'Kelas', 'Kode', 'Mata Pelajaran']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105] },
            styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 15 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20, fontStyle: 'bold' }, 5: { cellWidth: 20, fontStyle: 'bold' }, 6: { cellWidth: 'auto', halign: 'left' } }
        });
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text(`Total Jam Mengajar: ${tableBody.length} Jam`, 14, finalY);
    }
    doc.save(`Jadwal_Guru_${selectedTeacherId.replace(/\s+/g, '_')}.pdf`);
  };

  // --- RENDERERS ---

  const renderClassSchedule = () => {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 sticky top-20 z-10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-2 bg-indigo-50 rounded-full">
                <School className="text-indigo-600 w-6 h-6" />
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pilih Kelas</label>
                <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={role === 'STUDENT'}
                className={`w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm ${role === 'STUDENT' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
          </div>
          <button 
            onClick={downloadClassSchedulePDF}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
          >
            <Download size={18} /> Download PDF
          </button>
        </div>

        {SCHEDULE_DATA.map((daySchedule) => {
          const rows = daySchedule.rows;
          if (rows.length === 0) return null;

          return (
            <div key={daySchedule.day} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-indigo-600 border-b border-indigo-700 flex justify-between items-center">
                 <span className="font-bold text-white tracking-wide">JADWAL {daySchedule.day}</span>
                 <span className="text-xs text-indigo-100 bg-indigo-700 px-2 py-1 rounded">Kelas {selectedClass}</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                   <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-16">Jam</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-32">Waktu</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-24">Kode Mapel</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600 border-r border-gray-200">Mata Pelajaran</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Nama Guru</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                      {rows.map((row, idx) => {
                         if (row.activity) {
                           return (
                             <tr key={`activity-${idx}`} className="bg-orange-50/60">
                               <td className="px-4 py-3 text-center font-bold text-gray-500 border-r border-gray-100">{row.jam}</td>
                               <td className="px-4 py-3 text-center text-gray-500 text-xs border-r border-gray-100 font-mono">{row.waktu}</td>
                               <td colSpan={3} className="px-4 py-3 text-center font-bold text-orange-800 uppercase tracking-wide text-xs">
                                 {row.activity}
                               </td>
                             </tr>
                           );
                         }

                         const key = `${daySchedule.day}-${row.jam}-${selectedClass}`;
                         const code = scheduleMap[key];
                         const info = code ? codeToDataMap[String(code)] : null;
                         const colorClass = code ? codeColorMap[String(code)] : 'bg-gray-50 text-gray-300';

                         return (
                           <tr key={row.jam} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-center font-bold text-gray-700 border-r border-gray-100">{row.jam}</td>
                              <td className="px-4 py-3 text-center text-gray-500 text-xs border-r border-gray-100 font-mono">{row.waktu}</td>
                              <td className="px-4 py-3 text-center border-r border-gray-100">
                                 {code ? (
                                   <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${colorClass} w-20`}>
                                     {code}
                                   </span>
                                 ) : (
                                   <span className="text-gray-300">-</span>
                                 )}
                              </td>
                              <td className="px-4 py-3 text-gray-800 border-r border-gray-100 font-medium">{info?.subject || "-"}</td>
                              <td className="px-4 py-3 text-gray-600">{info?.name || "-"}</td>
                           </tr>
                         );
                      })}
                   </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTeacherSchedule = () => {
    let counter = 1;
    const teacherScheduleRows: TeacherScheduleRow[] = [];
    const myCodes = teacherData.filter(t => t.name === selectedTeacherId).map(t => t.code);

    SCHEDULE_DATA.forEach(day => {
       day.rows.forEach(row => {
          if (row.activity) return;
          CLASSES.forEach(cls => {
             const key = `${day.day}-${row.jam}-${cls}`;
             const scheduledCode = scheduleMap[key];
             if (scheduledCode && myCodes.includes(scheduledCode)) {
                const info = codeToDataMap[String(scheduledCode)];
                teacherScheduleRows.push({
                   no: counter++,
                   day: day.day,
                   jam: row.jam,
                   waktu: row.waktu,
                   cls: cls,
                   code: scheduledCode,
                   subject: info?.subject || '-'
                });
             }
          });
       });
    });

    return (
      <div className="space-y-6 animate-fade-in">
         <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 sticky top-20 z-10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-2 bg-emerald-50 rounded-full">
                <User className="text-emerald-600 w-6 h-6" />
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pilih Guru</label>
                <select 
                value={selectedTeacherId} 
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                disabled={role === 'TEACHER'}
                className={`w-full md:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm ${role === 'TEACHER' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                <option value="">-- Pilih Nama Guru --</option>
                {teacherNames.map((name: string) => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
          </div>
          {selectedTeacherId && (
            <button 
                onClick={downloadTeacherSchedulePDF}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
            >
                <Download size={18} /> Download PDF
            </button>
          )}
        </div>

        {selectedTeacherId && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-emerald-600 border-b border-emerald-700 flex justify-between items-center text-white">
               <span className="font-bold tracking-wide">JADWAL MENGAJAR</span>
               <span className="text-sm bg-emerald-700 px-3 py-1 rounded-full font-medium">Total: {teacherScheduleRows.length} Jam</span>
            </div>
            
            <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                     <tr>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-12">No</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-20">Jam Ke</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-32">Waktu</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-32">Hari</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-24">Kelas</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 border-r border-gray-200 w-24">Kode</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Mata Pelajaran</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                     {teacherScheduleRows.length > 0 ? (
                        teacherScheduleRows.map((row) => (
                           <tr key={`${row.day}-${row.jam}-${row.cls}`} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-4 py-3 text-center text-gray-500 border-r border-gray-100">{row.no}</td>
                              <td className="px-4 py-3 text-center font-bold text-gray-800 border-r border-gray-100">{row.jam}</td>
                              <td className="px-4 py-3 text-center text-gray-500 text-xs border-r border-gray-100 font-mono">{row.waktu}</td>
                              <td className="px-4 py-3 text-center font-bold text-emerald-700 border-r border-gray-100">{row.day}</td>
                              <td className="px-4 py-3 text-center border-r border-gray-100">
                                 <span className={`inline-block px-2 py-1 rounded font-bold text-xs shadow-sm ${getClassColor(row.cls)}`}>
                                   {row.cls}
                                 </span>
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-gray-600 border-r border-gray-100">{row.code}</td>
                              <td className="px-4 py-3 text-left text-gray-800">{row.subject}</td>
                           </tr>
                        ))
                     ) : (
                        <tr>
                           <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">
                              Guru ini belum memiliki jadwal mengajar yang diplot.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAttendanceInput = () => {
    // Determine Schedule for selected date
    const dayName = getDayNameFromDate(attendanceDate);
    const daySchedule = SCHEDULE_DATA.find(d => d.day === dayName);
    
    // Get relevant teacher absences for this date and class
    const getRelevantAbsences = () => {
        if (!teacherLeaves || teacherLeaves.length === 0) return [];
        if (!daySchedule) return [];
        
        const absences: { name: string, subject: string, type: string, description?: string }[] = [];
        const seenTeachers = new Set<string>();

        daySchedule.rows.forEach(row => {
            if (row.activity) return;
            const key = `${dayName}-${row.jam}-${selectedClass}`;
            const code = scheduleMap[key];
            if (code) {
                const info = codeToDataMap[code];
                if (info && !seenTeachers.has(info.name)) {
                   // Check if this teacher has leave on this date
                   const leave = teacherLeaves.find(l => l.teacherName === info.name && l.date === attendanceDate);
                   if (leave) {
                       absences.push({
                           name: info.name,
                           subject: info.subject,
                           type: leave.type,
                           description: leave.description
                       });
                       seenTeachers.add(info.name);
                   }
                }
            }
        });
        return absences;
    };
    
    const relevantAbsences = getRelevantAbsences();

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="text-indigo-600" /> 
                    Input Kehadiran Guru
                 </h3>
                 <p className="text-sm text-gray-500">
                    Kelas: <span className="font-bold text-indigo-700">{selectedClass}</span>
                 </p>
              </div>
              <div className="flex items-center gap-2">
                 <label className="text-xs font-bold text-gray-600">Tanggal:</label>
                 <input 
                   type="date" 
                   value={attendanceDate}
                   onChange={(e) => setAttendanceDate(e.target.value)}
                   className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800"
                 />
              </div>
           </div>

           {isHoliday ? (
              <div className="p-8 text-center bg-red-50 rounded-lg border border-red-100">
                 <CalendarClock className="w-12 h-12 text-red-400 mx-auto mb-2" />
                 <h4 className="text-lg font-bold text-red-700">Hari Libur</h4>
                 <p className="text-red-600">{isHoliday.description}</p>
                 <p className="text-xs text-red-500 mt-2">Tidak dapat mengisi kehadiran.</p>
              </div>
           ) : (
             <>
               {daySchedule ? (
                 <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                       <thead className="bg-gray-50">
                          <tr>
                             <th className="px-4 py-3 text-center font-bold text-gray-600 w-16">Jam</th>
                             <th className="px-4 py-3 text-center font-bold text-gray-600 w-32">Waktu</th>
                             <th className="px-4 py-3 text-left font-bold text-gray-600">Mata Pelajaran</th>
                             <th className="px-4 py-3 text-left font-bold text-gray-600">Nama Guru</th>
                             <th className="px-4 py-3 text-center font-bold text-gray-600">Kehadiran</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-200">
                          {daySchedule.rows.map(row => {
                             if (row.activity) return null;
                             const key = `${daySchedule.day}-${row.jam}-${selectedClass}`;
                             const code = scheduleMap[key];
                             if (!code) return null;
                             
                             const info = codeToDataMap[code];
                             const recordKey = `${attendanceDate}-${row.jam}-${selectedClass}`;
                             const status = attendanceData[recordKey];

                             return (
                                <tr key={row.jam} className="hover:bg-gray-50">
                                   <td className="px-4 py-3 text-center font-bold text-gray-700">{row.jam}</td>
                                   <td className="px-4 py-3 text-center text-xs text-gray-500 font-mono">{row.waktu}</td>
                                   <td className="px-4 py-3 font-medium text-gray-800">{info?.subject}</td>
                                   <td className="px-4 py-3 text-gray-600">{info?.name}</td>
                                   <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-4">
                                         <label className="flex items-center gap-1 cursor-pointer">
                                            <input 
                                              type="radio" 
                                              name={`att-${row.jam}`} 
                                              checked={status === 'HADIR'} 
                                              onChange={() => handleAttendanceChange(recordKey, 'HADIR')}
                                              className="text-green-600 focus:ring-green-500"
                                            />
                                            <span className="text-xs font-bold text-green-700">Hadir</span>
                                         </label>
                                         <label className="flex items-center gap-1 cursor-pointer">
                                            <input 
                                              type="radio" 
                                              name={`att-${row.jam}`} 
                                              checked={status === 'TIDAK_HADIR'} 
                                              onChange={() => handleAttendanceChange(recordKey, 'TIDAK_HADIR')}
                                              className="text-red-600 focus:ring-red-500"
                                            />
                                            <span className="text-xs font-bold text-red-700">Tidak Hadir</span>
                                         </label>
                                         <label className="flex items-center gap-1 cursor-pointer">
                                            <input 
                                              type="radio" 
                                              name={`att-${row.jam}`} 
                                              checked={status === 'DINAS_LUAR'} 
                                              onChange={() => handleAttendanceChange(recordKey, 'DINAS_LUAR')}
                                              className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs font-bold text-blue-700">Dinas Luar</span>
                                         </label>
                                         {status && (
                                            <button 
                                                onClick={() => resetAttendanceRow(recordKey)}
                                                className="ml-2 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                                title="Hapus / Reset"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                         )}
                                      </div>
                                   </td>
                                </tr>
                             );
                          })}
                          {daySchedule.rows.filter(r => !r.activity && scheduleMap[`${daySchedule.day}-${r.jam}-${selectedClass}`]).length === 0 && (
                             <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada jadwal pelajaran hari ini.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
               ) : (
                  <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                     Pilih tanggal yang valid.
                  </div>
               )}

               {/* RELEVANT ABSENCES INFO BOX */}
               {relevantAbsences.length > 0 && (
                   <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 animate-fade-in-up">
                       <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2 mb-3">
                           <Info size={16} /> Info Guru Berhalangan
                       </h4>
                       <div className="space-y-2">
                           {relevantAbsences.map((abs, idx) => (
                               <div key={idx} className="bg-white p-3 rounded border border-yellow-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2">
                                   <div>
                                       <span className="font-bold text-gray-800">{abs.name}</span>
                                       <span className="text-xs text-gray-500 ml-2">({abs.subject})</span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                       <span className={`text-xs font-bold px-2 py-1 rounded 
                                          ${abs.type === 'SAKIT' ? 'bg-red-100 text-red-700' : 
                                            abs.type === 'IZIN' ? 'bg-orange-100 text-orange-700' : 
                                            'bg-blue-100 text-blue-700'}`}>
                                           {abs.type.replace('_', ' ')}
                                       </span>
                                       <span className="text-xs text-gray-600 italic">{abs.description}</span>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               )}

               <div className="mt-4 flex justify-end">
                  <button 
                    onClick={saveAttendance}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                  >
                     <Save size={18} /> Simpan Kehadiran
                  </button>
               </div>
             </>
           )}
        </div>
      </div>
    );
  };

  const renderJournal = () => {
    const countAttendance = (status: 'H'|'S'|'I'|'A'|'DL') => {
       if (!jourForm.studentAttendance) return 0;
       return Object.values(jourForm.studentAttendance).filter(v => v === status).length;
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
           <div className="flex items-center gap-2">
             <div className="p-2 bg-blue-50 rounded-full">
               <BookOpen className="text-blue-600 w-6 h-6" />
             </div>
             <h3 className="font-bold text-gray-800">Jurnal Mengajar</h3>
           </div>
           
           <div className="flex bg-gray-100 p-1 rounded-lg">
             <button 
               onClick={() => setJournalMode('INPUT_MATERI')}
               className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${journalMode === 'INPUT_MATERI' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               Input Materi
             </button>
             <button 
               onClick={() => setJournalMode('INPUT_JURNAL')}
               className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${journalMode === 'INPUT_JURNAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               Input Jurnal
             </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
              {journalMode === 'INPUT_MATERI' ? (
                <form onSubmit={saveMaterial} className="space-y-4">
                  <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                     <PenTool size={16} className="text-blue-500" /> Form Input Materi
                  </h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Semester</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={matForm.semester === '1'} onChange={() => setMatForm({...matForm, semester: '1'})} />
                        <span className="text-sm">Ganjil (1)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={matForm.semester === '2'} onChange={() => setMatForm({...matForm, semester: '2'})} />
                        <span className="text-sm">Genap (2)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">Pilih Kelas</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CLASSES.map(cls => (
                        <label key={cls} className="flex items-center gap-1.5 text-xs cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={matForm.classes.includes(cls)}
                             onChange={() => handleMatClassToggle(cls)}
                             className="rounded text-blue-600 focus:ring-blue-500"
                           />
                           {cls}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Bab</label>
                    <input 
                      type="text" 
                      required
                      value={matForm.chapter}
                      onChange={(e) => setMatForm({...matForm, chapter: e.target.value})}
                      placeholder="Contoh: Bab 1 - Bilangan Bulat"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Sub Bab</label>
                    <div className="space-y-2">
                      {matForm.subChapters.map((sub, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                             type="text"
                             required
                             value={sub}
                             onChange={(e) => handleSubChapterChange(idx, e.target.value)}
                             placeholder={`Sub Bab ${idx + 1}`}
                             className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          {idx > 0 && (
                            <button type="button" onClick={() => removeSubChapter(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={addSubChapter}
                        className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                      >
                        <Plus size={14} /> Tambah Sub Bab
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm mt-4">
                    Simpan Materi
                  </button>
                </form>
              ) : (
                <form onSubmit={saveJournal} className="space-y-4">
                  <div className="border-b pb-2 mb-4 flex items-center justify-between">
                     <h4 className="font-bold text-gray-800 flex items-center gap-2">
                        {editingJournalId ? <Edit2 size={16} className="text-orange-500" /> : <FileText size={16} className="text-blue-500" />} 
                        {editingJournalId ? 'Edit Jurnal' : 'Form Jurnal'}
                     </h4>
                     {editingJournalId && (
                       <button 
                         type="button" 
                         onClick={handleCancelEdit}
                         className="text-xs text-red-500 hover:underline flex items-center gap-1"
                       >
                         <X size={14} /> Batal Edit
                       </button>
                     )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label>
                       <input 
                         type="date"
                         required
                         value={jourForm.date}
                         onChange={(e) => setJourForm({...jourForm, date: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                       />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-gray-600 mb-1">Semester</label>
                       <select 
                         value={jourForm.semester}
                         onChange={(e) => setJourForm({...jourForm, semester: e.target.value as '1'|'2'})}
                         className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                       >
                         <option value="1">Ganjil</option>
                         <option value="2">Genap</option>
                       </select>
                     </div>
                  </div>

                  {/* JAM KE CHECKBOXES */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">Jam Ke (Jadwal) - Pilih Minimal Satu</label>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                      {myTeachingSlots.length > 0 ? myTeachingSlots.map((slot, idx) => {
                         const val = `${slot.day}|${slot.jam}|${slot.cls}`;
                         const isChecked = jourForm.jamKe.split(',').includes(val);
                         return (
                            <label key={idx} className="flex items-center gap-2 text-xs p-1 hover:bg-gray-50 rounded cursor-pointer">
                               <input 
                                 type="checkbox"
                                 checked={isChecked}
                                 onChange={() => handleJamKeSelection(val)}
                                 className="rounded text-blue-600 focus:ring-blue-500"
                               />
                               <span className="font-medium text-gray-700">{slot.day} - Jam {slot.jam} ({slot.cls})</span>
                            </label>
                         );
                      }) : <p className="text-xs text-gray-400 italic p-1">Tidak ada jadwal.</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Kelas</label>
                    <input 
                       type="text"
                       readOnly
                       disabled
                       value={jourForm.className}
                       className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed font-semibold"
                       placeholder="Otomatis dari jadwal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Bab (Materi)</label>
                    <select 
                       required
                       value={jourForm.chapter}
                       onChange={(e) => setJourForm({...jourForm, chapter: e.target.value, subChapter: ''})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                       disabled={!jourForm.className}
                    >
                       <option value="">-- Pilih Bab --</option>
                       {availableChapters.map(m => (
                          <option key={m.id} value={m.chapter}>{m.chapter}</option>
                       ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">Sub Bab - Pilih Minimal Satu</label>
                    <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-white">
                       {availableSubChapters.length > 0 ? availableSubChapters.map((sub, idx) => {
                          const isChecked = jourForm.subChapter.split(',').map(s => s.trim()).includes(sub);
                          return (
                             <label key={idx} className="flex items-center gap-2 text-xs p-1 hover:bg-gray-50 rounded cursor-pointer">
                                <input 
                                   type="checkbox"
                                   checked={isChecked}
                                   onChange={() => handleJournalSubChapterToggle(sub)}
                                   className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>{sub}</span>
                             </label>
                          );
                       }) : <p className="text-xs text-gray-400 italic">Pilih Bab dulu.</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Kegiatan Pembelajaran</label>
                    <textarea 
                       required
                       value={jourForm.activity}
                       onChange={(e) => setJourForm({...jourForm, activity: e.target.value})}
                       rows={2}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                       placeholder="Diskusi kelompok..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Catatan</label>
                    <input 
                       type="text"
                       value={jourForm.notes}
                       onChange={(e) => setJourForm({...jourForm, notes: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                       placeholder="Siswa aktif bertanya..."
                    />
                  </div>
                  
                  {/* Photo Upload */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Foto Dokumentasi</label>
                    <input 
                       type="file" 
                       accept="image/*"
                       onChange={handlePhotoUpload}
                       className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {jourForm.documentationPhoto && (
                       <div className="mt-2 relative group w-fit">
                          <img src={jourForm.documentationPhoto} alt="Dokumentasi" className="h-20 w-auto rounded border border-gray-200" />
                          <button 
                             type="button"
                             onClick={() => setJourForm({...jourForm, documentationPhoto: ''})}
                             className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             <X size={12} />
                          </button>
                       </div>
                    )}
                  </div>

                  {/* ATTENDANCE TABLE */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Absensi Siswa</label>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                       <div className="max-h-60 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-xs">
                             <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                   <th className="px-2 py-2 text-left w-8">No</th>
                                   <th className="px-2 py-2 text-left">Nama</th>
                                   <th className="px-2 py-2 text-center">Kehadiran</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100">
                                {jourForm.className && students.filter(s => s.className === jourForm.className).length > 0 ? (
                                   students.filter(s => s.className === jourForm.className).map((student, idx) => (
                                      <tr key={student.id}>
                                         <td className="px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
                                         <td className="px-2 py-1.5 font-medium text-gray-700 truncate max-w-[120px]" title={student.name}>{student.name}</td>
                                         <td className="px-2 py-1.5 flex justify-center gap-1.5">
                                            {['H', 'S', 'I', 'A', 'DL'].map(status => (
                                               <label key={status} className="flex items-center gap-0.5 cursor-pointer">
                                                  <input 
                                                     type="radio" 
                                                     name={`att-${student.id}`} 
                                                     checked={jourForm.studentAttendance[student.id] === status} 
                                                     onChange={() => handleStudentAttendanceChange(student.id, status as any)}
                                                     className="w-3 h-3 text-blue-600 focus:ring-0"
                                                  />
                                                  <span className="text-[10px] font-bold text-gray-600">{status}</span>
                                               </label>
                                            ))}
                                         </td>
                                      </tr>
                                   ))
                                ) : (
                                   <tr>
                                      <td colSpan={3} className="px-2 py-4 text-center text-gray-400 italic">
                                         {jourForm.className ? "Tidak ada data siswa." : "Pilih Jam Ke (Jadwal) dulu."}
                                      </td>
                                   </tr>
                                )}
                             </tbody>
                          </table>
                       </div>
                    </div>
                    {/* Attendance Summary */}
                    {jourForm.className && (
                       <div className="flex gap-2 mt-2 text-[10px] font-bold bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="text-green-700">H: {countAttendance('H')}</span>
                          <span className="text-red-700">S: {countAttendance('S')}</span>
                          <span className="text-yellow-700">I: {countAttendance('I')}</span>
                          <span className="text-purple-700">A: {countAttendance('A')}</span>
                          <span className="text-blue-700">DL: {countAttendance('DL')}</span>
                       </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {editingJournalId && (
                       <button 
                         type="button" 
                         onClick={handleCancelEdit}
                         className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-300 shadow-sm"
                       >
                         Batal
                       </button>
                    )}
                    <button 
                      type="submit" 
                      className={`flex-1 text-white py-2 rounded-lg font-bold shadow-sm ${editingJournalId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {editingJournalId ? 'Simpan Perubahan' : 'Simpan Jurnal'}
                    </button>
                  </div>
                </form>
              )}
           </div>

           {/* LIST SECTION */}
           <div className="lg:col-span-2 space-y-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                 <ClipboardList size={18} className="text-indigo-600" /> 
                 {journalMode === 'INPUT_MATERI' ? 'Daftar Materi Saya' : 'Riwayat Jurnal Mengajar'}
              </h4>
              
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                 <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                       {journalMode === 'INPUT_MATERI' ? (
                         <tr>
                           <th className="px-4 py-3 text-left font-bold text-gray-600">Sem</th>
                           <th className="px-4 py-3 text-left font-bold text-gray-600">Kelas</th>
                           <th className="px-4 py-3 text-left font-bold text-gray-600">Bab / Sub Bab</th>
                           <th className="px-4 py-3 text-center font-bold text-gray-600">Aksi</th>
                         </tr>
                       ) : (
                         <tr>
                           <th className="px-4 py-3 text-left font-bold text-gray-600 w-24">Tanggal</th>
                           <th className="px-4 py-3 text-center font-bold text-gray-600 w-16">Kelas</th>
                           <th className="px-4 py-3 text-center font-bold text-gray-600 w-16">Jam Ke</th>
                           <th className="px-4 py-3 text-left font-bold text-gray-600">Materi & Kegiatan</th>
                           <th className="px-4 py-3 text-center font-bold text-gray-600 w-16">Foto</th>
                           <th className="px-4 py-3 text-left font-bold text-gray-600 w-32">Absensi</th>
                           <th className="px-4 py-3 text-center font-bold text-gray-600 w-20">Aksi</th>
                         </tr>
                       )}
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                       {journalMode === 'INPUT_MATERI' ? (
                          teachingMaterials.filter(m => m.teacherName === currentUser).map(m => (
                             <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-center font-bold text-gray-500">{m.semester}</td>
                                <td className="px-4 py-3">
                                   <div className="flex flex-wrap gap-1">
                                      {m.classes.map(c => <span key={c} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">{c}</span>)}
                                   </div>
                                </td>
                                <td className="px-4 py-3">
                                   <div className="font-bold text-gray-800">{m.chapter}</div>
                                   <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                                      {m.subChapters.map((s, i) => <li key={i}>{s}</li>)}
                                   </ul>
                                </td>
                                <td className="px-4 py-3 text-center">
                                   {onDeleteMaterial && (
                                     <button onClick={() => onDeleteMaterial(m.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                                        <Trash2 size={16} />
                                     </button>
                                   )}
                                </td>
                             </tr>
                          ))
                       ) : (
                          myJournals.map(j => {
                             let jamDisplay = j.jamKe;
                             if(j.jamKe && j.jamKe.includes('|')) {
                                const slots = j.jamKe.split(',');
                                const nums = slots.map(s => s.split('|')[1]);
                                jamDisplay = nums.join(', ');
                             }
                             return (
                             <tr key={j.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">{j.date}</td>
                                <td className="px-4 py-3 text-center font-bold text-gray-800">{j.className}</td>
                                <td className="px-4 py-3 text-center text-xs text-gray-600 font-mono">{jamDisplay}</td>
                                <td className="px-4 py-3">
                                   <div className="text-xs font-bold text-indigo-700">{j.chapter}</div>
                                   <div className="text-xs text-gray-500 mb-1">{j.subChapter}</div>
                                   <div className="text-sm text-gray-800">{j.activity}</div>
                                   {j.notes && <div className="text-xs text-gray-500 italic mt-1">Catatan: {j.notes}</div>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                   {j.documentationPhoto ? (
                                      <button 
                                        onClick={() => setPreviewImage(j.documentationPhoto || null)}
                                        className="relative group block mx-auto w-10 h-10"
                                      >
                                        <img src={j.documentationPhoto} alt="Dok" className="h-10 w-10 rounded object-cover border border-gray-200 shadow-sm" />
                                        <div className="absolute inset-0 bg-black/30 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                           <ZoomIn size={16} className="text-white" />
                                        </div>
                                      </button>
                                   ) : (
                                     <span className="text-xs text-gray-400 italic">No Foto</span>
                                   )}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600">
                                    {j.studentAttendance ? (
                                        (() => {
                                            const details: string[] = [];
                                            Object.entries(j.studentAttendance).forEach(([sid, status]) => {
                                                if (status !== 'H') {
                                                   const stu = students.find(s => s.id === sid);
                                                   details.push(`${status}: ${stu ? stu.name : '?'}`);
                                                }
                                            });
                                            return details.length > 0 ? (
                                                <div className="space-y-0.5">
                                                   {details.map((d, i) => (
                                                      <div key={i} className={`font-semibold ${d.startsWith('S') ? 'text-red-600' : d.startsWith('I') ? 'text-yellow-600' : d.startsWith('A') ? 'text-purple-600' : 'text-blue-600'}`}>{d}</div>
                                                   ))}
                                                </div>
                                            ) : <span className="text-green-600 font-medium">Hadir Semua</span>;
                                        })()
                                    ) : (
                                        typeof j.attendance === 'string' ? j.attendance : '-'
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                   <div className="flex items-center justify-center gap-1">
                                      <button 
                                         onClick={() => handleEditJournalClick(j)} 
                                         className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                         title="Edit"
                                      >
                                         <Edit2 size={16} />
                                      </button>
                                      {onDeleteJournal && (
                                        <button 
                                           onClick={() => onDeleteJournal(j.id)} 
                                           className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                           title="Hapus"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                      )}
                                   </div>
                                </td>
                             </tr>
                             );
                          })
                       )}
                       
                       {(journalMode === 'INPUT_MATERI' ? teachingMaterials.filter(m => m.teacherName === currentUser) : myJournals).length === 0 && (
                          <tr>
                             <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                Belum ada data.
                             </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderAttendanceMonitoring = () => {
    const myClasses = Array.from(new Set(teacherData.filter(t => t.name === currentUser).flatMap(t => {
       const classes: string[] = [];
       const extract = (grade: string, hoursObj: any) => {
          Object.entries(hoursObj).forEach(([cls, hrs]) => {
             if (Number(hrs) > 0) classes.push(`${grade} ${cls}`);
          });
       };
       extract('VII', t.hoursVII);
       extract('VIII', t.hoursVIII);
       extract('IX', t.hoursIX);
       return classes;
    }))).sort();

    const classJournals = teachingJournals.filter(j => 
       j.teacherName === currentUser && 
       j.className === monitoringClass
    ).sort((a,b) => a.date.localeCompare(b.date));

    const journalColumns = classJournals.map(j => ({
       id: j.id,
       date: j.date,
       jam: j.jamKe ? (j.jamKe.includes('|') ? j.jamKe.split(',').map(s => s.split('|')[1]).join(',') : j.jamKe) : '?'
    }));

    const classStudents = students.filter(s => s.className === monitoringClass).sort((a,b) => a.name.localeCompare(b.name));

    return (
       <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
             <div className="p-2 bg-purple-50 rounded-full">
                <BarChart3 className="text-purple-600 w-6 h-6" />
             </div>
             <div>
                <h3 className="font-bold text-gray-800">Monitoring Absensi Siswa</h3>
                <p className="text-xs text-gray-500">Rekapitulasi kehadiran siswa berdasarkan jurnal mengajar.</p>
             </div>
             <div className="ml-auto flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">Pilih Kelas:</label>
                <select 
                   value={monitoringClass}
                   onChange={(e) => setMonitoringClass(e.target.value)}
                   className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-purple-500"
                >
                   {myClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                   <thead className="bg-gray-50">
                      <tr>
                         <th rowSpan={2} className="px-3 py-2 text-center border-r border-gray-200 w-10 font-bold text-gray-600">No</th>
                         <th rowSpan={2} className="px-3 py-2 text-left border-r border-gray-200 min-w-[150px] font-bold text-gray-600">Nama Siswa</th>
                         {journalColumns.length > 0 ? (
                           <th colSpan={journalColumns.length} className="px-3 py-2 text-center border-r border-gray-200 font-bold text-gray-700 bg-purple-50">
                              Tanggal Pertemuan
                           </th>
                         ) : (
                           <th className="px-3 py-2 text-center border-r border-gray-200 font-bold text-gray-400">Belum Ada Data</th>
                         )}
                         <th colSpan={5} className="px-3 py-2 text-center font-bold text-gray-700 bg-gray-100">Rekapitulasi</th>
                      </tr>
                      <tr>
                         {journalColumns.map((col) => (
                            <th key={col.id} className="px-2 py-2 text-center border-r border-gray-200 min-w-[60px] whitespace-nowrap">
                               <div className="text-gray-800">{col.date}</div>
                               <div className="text-[10px] text-gray-500">Jam {col.jam}</div>
                            </th>
                         ))}
                         {/* Totals Header */}
                         <th className="px-2 py-1 text-center w-8 bg-green-50 text-green-700">H</th>
                         <th className="px-2 py-1 text-center w-8 bg-red-50 text-red-700">S</th>
                         <th className="px-2 py-1 text-center w-8 bg-yellow-50 text-yellow-700">I</th>
                         <th className="px-2 py-1 text-center w-8 bg-purple-50 text-purple-700">A</th>
                         <th className="px-2 py-1 text-center w-8 bg-blue-50 text-blue-700">DL</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                      {classStudents.length > 0 ? (
                         classStudents.map((student, idx) => {
                            let countH = 0, countS = 0, countI = 0, countA = 0, countDL = 0;
                            
                            return (
                               <tr key={student.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-center text-gray-500 border-r border-gray-200">{idx + 1}</td>
                                  <td className="px-3 py-2 font-medium text-gray-800 border-r border-gray-200">{student.name}</td>
                                  
                                  {classJournals.map(j => {
                                     const status = j.studentAttendance?.[student.id] || '-';
                                     let bgColor = 'text-gray-400';
                                     if (status === 'H') { countH++; bgColor = 'text-green-600 font-bold'; }
                                     else if (status === 'S') { countS++; bgColor = 'text-red-600 font-bold bg-red-50'; }
                                     else if (status === 'I') { countI++; bgColor = 'text-yellow-600 font-bold bg-yellow-50'; }
                                     else if (status === 'A') { countA++; bgColor = 'text-purple-600 font-bold bg-purple-50'; }
                                     else if (status === 'DL') { countDL++; bgColor = 'text-blue-600 font-bold bg-blue-50'; }

                                     return (
                                        <td key={j.id} className={`px-2 py-2 text-center border-r border-gray-200 ${bgColor.includes('bg') ? bgColor : ''}`}>
                                           <span className={!bgColor.includes('bg') ? bgColor : ''}>{status}</span>
                                        </td>
                                     );
                                  })}
                                  {classJournals.length === 0 && <td className="px-3 py-2 text-center border-r border-gray-200">-</td>}

                                  <td className="px-2 py-2 text-center font-bold text-gray-700 bg-gray-50/50">{countH}</td>
                                  <td className="px-2 py-2 text-center font-bold text-gray-700 bg-gray-50/50">{countS}</td>
                                  <td className="px-2 py-2 text-center font-bold text-gray-700 bg-gray-50/50">{countI}</td>
                                  <td className="px-2 py-2 text-center font-bold text-gray-700 bg-gray-50/50">{countA}</td>
                                  <td className="px-2 py-2 text-center font-bold text-gray-700 bg-gray-50/50">{countDL}</td>
                               </tr>
                            );
                         })
                      ) : (
                         <tr><td colSpan={journalColumns.length + 7} className="px-4 py-8 text-center text-gray-400">Tidak ada data siswa.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Navigation Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
        {role !== 'TEACHER' && (
           <button 
             onClick={() => setActiveTab('CLASS')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'CLASS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <School size={18} />
             Jadwal Per Kelas
           </button>
        )}
        {role !== 'STUDENT' && (
           <button 
             onClick={() => setActiveTab('TEACHER')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'TEACHER' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <User size={18} />
             Jadwal Per Guru
           </button>
        )}
        {role === 'STUDENT' && (
           <button 
             onClick={() => setActiveTab('ATTENDANCE')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'ATTENDANCE' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <CheckSquare size={18} />
             Input Kehadiran
           </button>
        )}
        {role === 'TEACHER' && (
           <>
             <button 
               onClick={() => setActiveTab('JOURNAL')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'JOURNAL' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
             >
               <BookOpen size={18} />
               Jurnal Mengajar
             </button>
             <button 
               onClick={() => setActiveTab('MONITORING')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'MONITORING' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
             >
               <BarChart3 size={18} />
               Monitoring Absensi
             </button>
           </>
        )}
      </div>

      {activeTab === 'CLASS' && renderClassSchedule()}
      {activeTab === 'TEACHER' && renderTeacherSchedule()}
      {activeTab === 'ATTENDANCE' && role === 'STUDENT' && renderAttendanceInput()}
      {activeTab === 'JOURNAL' && role === 'TEACHER' && renderJournal()}
      {activeTab === 'MONITORING' && role === 'TEACHER' && renderAttendanceMonitoring()}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
           <div className="relative max-w-4xl max-h-[90vh] w-auto">
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded shadow-2xl" />
              <button className="absolute -top-10 right-0 text-white hover:text-gray-300">
                 <X size={32} />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClassTeacherSchedule;
