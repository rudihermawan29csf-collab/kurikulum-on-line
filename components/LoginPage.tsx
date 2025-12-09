import React, { useState, useMemo } from 'react';
import { UserCog, GraduationCap, Users, Lock, X, ChevronRight, User } from 'lucide-react';
import { UserRole, AuthSettings, TeacherData } from '../types';
import { CLASSES } from '../constants';

interface LoginPageProps {
  onLogin: (role: UserRole, username?: string) => void;
  authSettings: AuthSettings;
  teacherData: TeacherData[];
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, authSettings, teacherData }) => {
  const [activeModal, setActiveModal] = useState<UserRole>(null); // 'ADMIN' | 'TEACHER' | 'STUDENT'
  
  // Login Form States
  const [selectedName, setSelectedName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Extract unique teacher names
  const teacherNames = useMemo(() => {
    return Array.from(new Set(teacherData.map(t => t.name))).sort();
  }, [teacherData]);

  const handleModalClose = () => {
    setActiveModal(null);
    setSelectedName('');
    setPassword('');
    setError('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (activeModal === 'ADMIN') {
      const validPass = authSettings.adminPassword || '007007Rh';
      if (password === validPass) {
        onLogin('ADMIN');
      } else {
        setError('Password salah!');
      }
    } 
    else if (activeModal === 'TEACHER') {
      if (!selectedName) {
        setError('Pilih nama guru terlebih dahulu.');
        return;
      }
      const storedPass = authSettings.teacherPasswords[selectedName];
      // If no password set, allow login without password or enforce a default?
      // Assuming secure: must match stored. If not stored, maybe default to empty?
      // Let's enforce: If no password set in settings, maybe use a default or empty.
      // Rule: Password MUST match. If not set, it matches empty string.
      if (password === (storedPass || '')) {
         onLogin('TEACHER', selectedName);
      } else {
         setError('Password salah!');
      }
    } 
    else if (activeModal === 'STUDENT') {
      if (!selectedName) {
        setError('Pilih kelas terlebih dahulu.');
        return;
      }
      const storedPass = authSettings.classPasswords[selectedName];
      if (password === (storedPass || '')) {
         onLogin('STUDENT', selectedName);
      } else {
         setError('Password salah!');
      }
    }
  };

  const getRoleTitle = () => {
    switch(activeModal) {
      case 'ADMIN': return 'Login Admin';
      case 'TEACHER': return 'Login Guru';
      case 'STUDENT': return 'Login Siswa';
      default: return 'Login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row animate-fade-in-up">
        
        {/* Left Side - Branding */}
        <div className="md:w-1/2 bg-indigo-600 p-10 flex flex-col justify-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 mb-6">
            <h1 className="text-3xl font-extrabold mb-2">Sistem Pembagian Tugas</h1>
            <h2 className="text-xl font-medium opacity-90">SMPN 3 Pacet</h2>
          </div>
          <p className="relative z-10 text-indigo-100 leading-relaxed mb-8">
            Platform terintegrasi untuk pengelolaan jadwal pelajaran, pembagian tugas guru, dan analisis beban kerja secara real-time.
          </p>
          <div className="relative z-10 text-xs text-indigo-300 mt-auto">
            &copy; 2025 SMPN 3 Pacet. All rights reserved.
          </div>
        </div>

        {/* Right Side - Role Selection */}
        <div className="md:w-1/2 p-10 flex flex-col justify-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Masuk Sebagai</h3>
          
          <div className="space-y-4">
            <button
              onClick={() => setActiveModal('ADMIN')}
              className="w-full group relative flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-600 hover:bg-indigo-50 transition-all duration-200"
            >
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <UserCog size={24} />
              </div>
              <div className="ml-4 text-left flex-1">
                <p className="text-lg font-bold text-gray-800 group-hover:text-indigo-700">Admin / Kurikulum</p>
                <p className="text-xs text-gray-500">Akses penuh pengaturan jadwal & data</p>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
            </button>

            <button
              onClick={() => setActiveModal('TEACHER')}
              className="w-full group relative flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-600 hover:bg-emerald-50 transition-all duration-200"
            >
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <GraduationCap size={24} />
              </div>
              <div className="ml-4 text-left flex-1">
                <p className="text-lg font-bold text-gray-800 group-hover:text-emerald-700">Guru</p>
                <p className="text-xs text-gray-500">Lihat jadwal mengajar & tugas</p>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-emerald-600 transition-colors" />
            </button>

            <button
              onClick={() => setActiveModal('STUDENT')}
              className="w-full group relative flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-orange-600 hover:bg-orange-50 transition-all duration-200"
            >
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
              <div className="ml-4 text-left flex-1">
                <p className="text-lg font-bold text-gray-800 group-hover:text-orange-700">Ketua Kelas / Siswa</p>
                <p className="text-xs text-gray-500">Lihat jadwal pelajaran kelas</p>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-orange-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Login Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-up border-t-4 border-indigo-600">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <Lock className="text-indigo-600" size={20}/> {getRoleTitle()}
               </h3>
               <button 
                 onClick={handleModalClose} 
                 className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
               >
                 <X size={20} />
               </button>
            </div>
            
            <form onSubmit={handleLoginSubmit}>
              
              {/* Identity Selector for Teacher/Student */}
              {activeModal === 'TEACHER' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Nama Guru</label>
                  <div className="relative">
                    <select 
                      value={selectedName}
                      onChange={(e) => setSelectedName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teacherNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
              )}

              {activeModal === 'STUDENT' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
                  <div className="relative">
                    <select 
                      value={selectedName}
                      onChange={(e) => setSelectedName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none appearance-none"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                    </select>
                    <Users className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if(error) setError('');
                  }}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 outline-none transition-all ${
                    error ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-300 focus:ring-indigo-500'
                  }`}
                  placeholder="Masukkan password..."
                  autoFocus
                />
                {error && <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1 animate-shake">⚠️ {error}</p>}
              </div>
              
              <div className="flex gap-3 justify-end mt-6">
                <button 
                  type="button" 
                  onClick={handleModalClose}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;