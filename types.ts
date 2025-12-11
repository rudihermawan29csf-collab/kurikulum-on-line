

export interface ClassHours {
  A?: number;
  B?: number;
  C?: number;
  [key: string]: number | undefined;
}

export interface TeacherData {
  id: number;
  no: string;
  name: string;
  nip?: string;
  rank?: string;
  gol?: string;
  subject: string;
  code: string;
  hoursVII: ClassHours;
  hoursVIII: ClassHours;
  hoursIX: ClassHours;
  additionalTask?: string;
  additionalHours: number;
  totalHours: number;
}

export enum ViewMode {
  TABLE = 'TABLE',
  SCHEDULE = 'SCHEDULE',
  VIEW_SCHEDULES = 'VIEW_SCHEDULES',
  SETTINGS = 'SETTINGS'
}

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | null;

export interface AppSettings {
  academicYear: string;
  semester: string;
  lastUpdated: string;
  logoUrl: string;
  headmaster?: string;
  headmasterNip?: string;
}

export interface AuthSettings {
  adminPassword?: string;
  teacherPasswords: Record<string, string>; // Teacher Name -> Password
  classPasswords: Record<string, string>;   // Class Name -> Password
}

export interface CalendarEvent {
  id: string;
  date: string;
  description: string;
}

export type LeaveType = 'SAKIT' | 'IZIN' | 'DINAS_LUAR';

export interface TeacherLeave {
  id: string;
  date: string;
  teacherId: number; // references TeacherData.id
  teacherName: string;
  type: LeaveType;
  description?: string;
}

export interface TeachingMaterial {
  id: string;
  teacherName: string; // Linked to logged in teacher
  subject?: string; // Mata Pelajaran
  semester: '1' | '2';
  classes: string[]; // List of classes, e.g. ['VII A', 'VII B']
  chapter: string; // Bab
  subChapters: string[]; // Sub Bab
}

export interface TeachingJournal {
  id: string;
  teacherName: string;
  subject?: string; // Added: Mata Pelajaran for Journal
  date: string;
  semester: '1' | '2';
  jamKe: string; // e.g. "1", "2" or "1-2"
  className: string;
  chapter: string;
  subChapter: string;
  activity: string;
  notes: string;
  studentAttendance: Record<string, 'H' | 'S' | 'I' | 'A' | 'DL'>; // Student ID -> Status
  attendance?: string;
}

export interface Student {
  id: string;
  name: string;
  className: string; // e.g., "VII A"
}

export interface SettingsPanelProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  authSettings: AuthSettings;
  onSaveAuth: (auth: AuthSettings) => void;
  teacherData: TeacherData[];
  teacherLeaves?: TeacherLeave[];
  onToggleLeave?: (leave: Omit<TeacherLeave, 'id'>) => void;
  onEditLeave?: (leave: TeacherLeave) => void;
  onDeleteLeave?: (id: string) => void;
  // Calendar Props
  calendarEvents?: CalendarEvent[];
  onUpdateCalendar?: (events: CalendarEvent[]) => void;
  // Holiday Props
  unavailableConstraints?: Record<string, string[]>;
  onToggleConstraint?: (code: string, day: string) => void;
  // Student Props
  students?: Student[];
  onAddStudent?: (student: Student) => void;
  onEditStudent?: (student: Student) => void;
  onDeleteStudent?: (id: string) => void;
  onBulkAddStudents?: (students: Student[]) => void;
}