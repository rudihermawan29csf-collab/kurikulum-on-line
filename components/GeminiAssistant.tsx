import React, { useState } from 'react';
import { askGemini } from '../services/geminiService';
import { MessageSquare, Send, Loader2, Sparkles, X } from 'lucide-react';
import { TeacherData } from '../types';

interface GeminiAssistantProps {
  teacherData: TeacherData[];
}

const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ teacherData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setAnswer('');
    try {
      const result = await askGemini(query, teacherData);
      setAnswer(result);
    } catch (err) {
      setAnswer("Maaf, terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all z-50 flex items-center justify-center"
        aria-label="Ask AI"
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden animate-fade-in-up">
          <div className="bg-indigo-600 p-4 flex items-center gap-2">
            <Sparkles className="text-yellow-300 w-5 h-5" />
            <h3 className="text-white font-bold">Asisten Analisis Data</h3>
          </div>
          
          <div className="flex-1 p-4 min-h-[300px] max-h-[400px] overflow-y-auto bg-gray-50">
            {!answer && !loading && (
              <div className="text-center text-gray-500 mt-10">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Tanyakan sesuatu tentang data guru.<br/>Contoh: "Siapa guru dengan jam terbanyak?"</p>
              </div>
            )}
            
            {loading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            )}
            
            {answer && (
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {answer}
              </div>
            )}
          </div>

          <form onSubmit={handleAsk} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tanya AI..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              type="submit" 
              disabled={loading || !query.trim()}
              className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default GeminiAssistant;