import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Settings, CheckCircle, XCircle, AlertTriangle, Lightbulb, SearchX, RefreshCcw, BarChart2, BookOpen, Download, Upload, Play, Library, Archive, RotateCcw, Target, Flame, Volume2, ShieldAlert, Trash2, LogOut, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, YAxis, CartesianGrid } from 'recharts';
import { diffChars } from 'diff';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { 
  getVocabulary, saveVocabulary, 
  getWordStats, saveWordStats, 
  getDailyStats, saveDailyStats, 
  VocabItem, WordStats, DayStats 
} from './services/vocabService';

const DEFAULT_VOCAB: VocabItem[] = [];

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const levenshteinDistance = (a: string, b: string): number => {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  
  const matrix = Array.from({ length: s2.length + 1 }, (_, i) => [i]);
  matrix[0] = Array.from({ length: s1.length + 1 }, (_, i) => i);
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[s2.length][s1.length];
};

const playAudio = (text: string, e?: React.MouseEvent) => {
  if (e) e.stopPropagation();
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const ut = new SpeechSynthesisUtterance(text);
  ut.lang = 'en-US';
  window.speechSynthesis.speak(ut);
};

export default function App() {
  const { user, isLoading } = useAuth();
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [wordStats, setWordStats] = useState<Record<number, WordStats>>({});
  const [dailyStats, setDailyStats] = useState<Record<string, DayStats>>({});
  
  const [activeTab, setActiveTab] = useState<'quiz' | 'stats' | 'manage'>('quiz');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  
  // Quiz states
  const [currentWord, setCurrentWord] = useState<VocabItem | null>(null);
  const [quizMode, setQuizMode] = useState<'typing' | 'mcq'>('typing');
  const [mcqOptions, setMcqOptions] = useState<VocabItem[]>([]);
  const [mcqSelected, setMcqSelected] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'guessing' | 'answered'>('idle');
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect' | 'typo', message?: string } | null>(null);
  
  const [hasFailedWord, setHasFailedWord] = useState(false);
  const [lastWrongTyped, setLastWrongTyped] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, typo: 0, mistakes: {} as Record<number, number> });
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // New Word Form State
  const [newWord, setNewWord] = useState({ word: '', meaning: '', type: 'noun', phonetic: '', tags: '' });
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [v, ws, ds] = await Promise.all([
          getVocabulary(user.uid),
          getWordStats(user.uid),
          getDailyStats(user.uid)
        ]);
        setVocab(v);
        setWordStats(ws);
        setDailyStats(ds);
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };
    fetchData();
  }, [user]);

  // Sync Data to Firestore (Debounced/Throttled in real app, but direct here for simplicity)
  const syncVocab = useCallback(async (newVocab: VocabItem[]) => {
    if (user) await saveVocabulary(user.uid, newVocab);
  }, [user]);

  const syncStats = useCallback(async (newWs: Record<number, WordStats>, newDs: Record<string, DayStats>) => {
    if (user) {
      await saveWordStats(user.uid, newWs);
      await saveDailyStats(user.uid, newDs);
    }
  }, [user]);

  // Derived vocab
  const targetVocabList = useMemo(() => {
    let list = vocab.filter(v => !v.archived);
    if (selectedTag === 'weakest') {
      return [...list].sort((a,b) => {
        const sA = wordStats[a.stt]?.incorrect || 0;
        const sB = wordStats[b.stt]?.incorrect || 0;
        return sB - sA;
      }).slice(0, 20);
    }
    if (selectedTag !== 'all') {
      list = list.filter(v => v.tags?.includes(selectedTag));
    }
    return list.length > 0 ? list : vocab.filter(v => !v.archived); 
  }, [vocab, selectedTag, wordStats]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    vocab.forEach(v => v.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [vocab]);

  const getRandomWord = (list: VocabItem[]) => {
    if (list.length === 0) return null;
    const weights = list.map(item => {
      const wStats = wordStats[item.stt];
      return 100 / ((wStats?.score || 0) + 1); 
    });
    const totalWeight = weights.reduce((acc, val) => acc + val, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  };

  const nextWord = useCallback((fullList = vocab, currentTarget = targetVocabList) => {
    const next = getRandomWord(currentTarget);
    if (!next) return;
    setCurrentWord(next);
    
    const isMcq = fullList.length >= 4 && Math.random() > 0.5;
    if (isMcq) {
      setQuizMode('mcq');
      const distractors = fullList.filter(v => v.stt !== next.stt).sort(() => 0.5 - Math.random()).slice(0, 3);
      setMcqOptions([...distractors, next].sort(() => 0.5 - Math.random()));
    } else {
      setQuizMode('typing');
    }
    
    setMcqSelected(null);
    setInputValue('');
    setStatus('guessing');
    setFeedback(null);
    setHintUsed(false);
    setHasFailedWord(false);
    setLastWrongTyped('');
    
    if (!isMcq) setTimeout(() => inputRef.current?.focus(), 50);
  }, [vocab, targetVocabList, wordStats]);

  useEffect(() => {
    if (vocab.length > 0 && status === 'idle' && activeTab === 'quiz') nextWord(vocab, targetVocabList);
  }, [vocab, activeTab, selectedTag, nextWord, status]);

  const applyScoreDelta = useCallback((stt: number, delta: number, resultType: 'correct'|'incorrect'|'typo') => {
    const currentWStats = wordStats[stt] || { score: 0, attempts: 0, correct: 0, incorrect: 0, typo: 0 };
    const newScore = Math.max(0, currentWStats.score + delta);
    const today = getTodayStr();

    const newWs = {
      ...wordStats,
      [stt]: {
        score: newScore,
        attempts: (wordStats[stt]?.attempts || 0) + 1,
        correct: (wordStats[stt]?.correct || 0) + (resultType === 'correct' ? 1 : 0),
        incorrect: (wordStats[stt]?.incorrect || 0) + (resultType === 'incorrect' ? 1 : 0),
        typo: (wordStats[stt]?.typo || 0) + (resultType === 'typo' ? 1 : 0),
        lastSeen: today
      }
    };

    const ds = dailyStats[today] || { correct: 0, incorrect: 0, typo: 0, total: 0, mastered: 0 };
    const newDs = {
      ...dailyStats,
      [today]: { ...ds,
        correct: ds.correct + (resultType === 'correct' ? 1 : 0),
        incorrect: ds.incorrect + (resultType === 'incorrect' ? 1 : 0),
        typo: ds.typo + (resultType === 'typo' ? 1 : 0),
        total: ds.total + 1
      }
    };

    setWordStats(newWs);
    setDailyStats(newDs);
    syncStats(newWs, newDs);

    setSessionStats(prev => {
      const mistakes = { ...prev.mistakes };
      if (resultType === 'incorrect') mistakes[stt] = (mistakes[stt] || 0) + 1;
      return {
        correct: prev.correct + (resultType === 'correct' ? 1 : 0),
        incorrect: prev.incorrect + (resultType === 'incorrect' ? 1 : 0),
        typo: prev.typo + (resultType === 'typo' ? 1 : 0),
        mistakes
      };
    });
  }, [wordStats, dailyStats, syncStats]);

  const useHint = useCallback(() => {
    if (!currentWord || status !== 'guessing' || quizMode !== 'typing') return;
    setHintUsed(true);
    const revealCount = Math.max(1, Math.floor(currentWord.word.length / 2));
    const revealedPart = currentWord.word.substring(0, revealCount);
    const hiddenPart = '_ '.repeat(currentWord.word.length - revealCount).trim();
    setInputValue(`${revealedPart}${hiddenPart.replace(/ /g, '')}`);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentWord, status, quizMode]);

  const checkTypingAnswer = useCallback(() => {
    if (!currentWord || !inputValue.trim() || status !== 'guessing') return;

    const dist = levenshteinDistance(currentWord.word, inputValue);
    const targetLength = currentWord.word.length;
    const threshold = targetLength <= 3 ? 0 : (targetLength <= 6 ? 1 : 2);
    
    if (dist === 0) {
      setFeedback({ type: 'correct' });
      applyScoreDelta(currentWord.stt, hasFailedWord ? 0 : (hintUsed ? 0 : 1), 'correct');
      setStatus('answered');
      playAudio(currentWord.word);
    } else {
      const isTypo = dist <= threshold;
      setFeedback({ type: isTypo ? 'typo' : 'incorrect', message: isTypo ? "Close! Pay attention." : "Incorrect." });
      setLastWrongTyped(inputValue);
      if (!hasFailedWord) applyScoreDelta(currentWord.stt, isTypo ? 0 : -1, isTypo ? 'typo' : 'incorrect');
      setHasFailedWord(true);
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentWord, inputValue, status, hasFailedWord, hintUsed, applyScoreDelta]);

  const handleMcqSelection = useCallback((idx: number) => {
    if (status !== 'guessing' || quizMode !== 'mcq' || !currentWord) return;
    setMcqSelected(idx);
    const selectedItem = mcqOptions[idx];
    const isCorrect = selectedItem.stt === currentWord.stt;
    if (isCorrect) {
      setFeedback({ type: 'correct' });
      applyScoreDelta(currentWord.stt, 1, 'correct');
    } else {
      setFeedback({ type: 'incorrect', message: `Correct: ${currentWord.meaning}` });
      applyScoreDelta(currentWord.stt, -1, 'incorrect');
    }
    setStatus('answered');
    playAudio(currentWord.word);
  }, [status, quizMode, currentWord, mcqOptions, applyScoreDelta]);

  // Keyboard Handlers
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (showSettings || showAddModal || activeTab !== 'quiz') return;
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); useHint(); return; }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); nextWord(); return; }
      if (!e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (status === 'guessing' && quizMode === 'typing') checkTypingAnswer();
        else if (status === 'answered') nextWord();
        return;
      }
      if (quizMode === 'mcq' && status === 'guessing' && !e.ctrlKey) {
         const num = parseInt(e.key);
         if (num >= 1 && num <= 4) { e.preventDefault(); handleMcqSelection(num - 1); }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [activeTab, status, quizMode, showSettings, showAddModal, useHint, checkTypingAnswer, handleMcqSelection, nextWord]);

  // Dashboard Stats
  const streak = useMemo(() => {
    const days = Object.keys(dailyStats).sort((a,b) => b.localeCompare(a));
    if (days.length === 0) return 0;
    let s = 0; const d = new Date();
    for (let i = 0; i < 365; i++) {
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dailyStats[dStr] && dailyStats[dStr].total > 0) s++;
        else if (i > 0) break;
        d.setDate(d.getDate() - 1);
    }
    return s;
  }, [dailyStats]);

  const totalMastered = useMemo(() => (Object.values(wordStats) as WordStats[]).filter(w => w.score >= 5).length, [wordStats]);
  const chartData = useMemo(() => {
    const data = []; const d = new Date(); d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const stat = dailyStats[ds];
      data.push({ date: `${d.getMonth()+1}/${d.getDate()}`, itemsLearned: stat ? stat.total : 0 });
      d.setDate(d.getDate() + 1);
    }
    return data;
  }, [dailyStats]);

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const stt = vocab.length > 0 ? Math.max(...vocab.map(v => v.stt)) + 1 : 1;
    const item: VocabItem = {
      stt,
      word: newWord.word.trim(),
      meaning: newWord.meaning.trim(),
      type: newWord.type,
      phonetic: newWord.phonetic.trim(),
      tags: newWord.tags.split(',').map(t => t.trim()).filter(t => t),
      archived: false
    };
    const newVocab = [...vocab, item];
    setVocab(newVocab);
    await syncVocab(newVocab);
    setShowAddModal(false);
    setNewWord({ word: '', meaning: '', type: 'noun', phonetic: '', tags: '' });
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed)) {
        setVocab(parsed);
        await syncVocab(parsed);
        setShowSettings(false);
      }
    } catch(e) { alert("Invalid JSON"); }
  };

  const stringDiff = useMemo(() => {
    if (!hasFailedWord || !lastWrongTyped || !currentWord) return null;
    return diffChars(lastWrongTyped.toLowerCase().trim(), currentWord.word.toLowerCase().trim());
  }, [lastWrongTyped, currentWord, hasFailedWord]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!user) return <Auth isLoading={isLoading} user={user} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 z-10 relative">
        <div className="flex items-center gap-2 text-indigo-600">
          <BookOpen className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Vocab Learner</h1>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('quiz')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'quiz' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}><Play className="w-4 h-4" /> Quiz</button>
          <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'stats' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}><BarChart2 className="w-4 h-4" /> Stats</button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'manage' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}><Library className="w-4 h-4" /> Manage</button>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => { setJsonInput(JSON.stringify(vocab, null, 2)); setShowSettings(true); }} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"><Settings className="w-5 h-5" /></button>
          <div className="h-8 w-[1px] bg-gray-200"></div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-rose-600 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto flex flex-col">
        {vocab.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
             <SearchX className="w-12 h-12 mb-4 text-gray-300" />
             <p>Your library is empty.</p>
             <button onClick={() => setShowAddModal(true)} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Add First Word</button>
           </div>
        ) : (
          <>
            {activeTab === 'quiz' && (
              <div className="max-w-3xl w-full mx-auto p-6 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-6">
                  <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className="text-sm font-bold text-indigo-700 bg-indigo-50 border-none rounded-lg p-2">
                    <option value="all">All Words</option>
                    <option value="weakest">🔥 Weakest</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {currentWord && (
                  <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center relative">
                    {quizMode === 'typing' ? (
                      <>
                        <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-8">{currentWord.meaning}</h2>
                        {hasFailedWord && stringDiff && (
                          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 font-mono text-xl">
                            {stringDiff.map((part, i) => (
                              <span key={i} className={part.added ? 'text-emerald-600 bg-emerald-50' : part.removed ? 'text-rose-400 line-through opacity-50' : 'text-gray-800'}>{part.value}</span>
                            ))}
                          </div>
                        )}
                        <input ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={status === 'answered'} className="w-full text-center text-2xl p-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none mb-6" autoFocus />
                      </>
                    ) : (
                      <>
                        <h2 className="text-4xl md:text-5xl font-extrabold text-indigo-900 mb-8 flex items-center justify-center gap-4">
                          {currentWord.word} <button onClick={() => playAudio(currentWord.word)}><Volume2 className="w-6 h-6 text-indigo-400" /></button>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          {mcqOptions.map((opt, idx) => (
                            <button key={idx} onClick={() => handleMcqSelection(idx)} disabled={status === 'answered'} className={`p-4 rounded-xl border-2 transition-all text-lg font-medium ${status === 'answered' ? (opt.stt === currentWord.stt ? 'border-emerald-500 bg-emerald-50' : (mcqSelected === idx ? 'border-rose-300 opacity-50' : 'border-gray-100 opacity-30')) : 'border-gray-100 hover:border-indigo-200'}`}>
                              {opt.meaning}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {status === 'answered' && <button onClick={() => nextWord()} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold uppercase tracking-widest">Next Word</button>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="max-w-4xl w-full mx-auto p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <div className="text-gray-400 text-sm mb-1">Streak</div>
                    <div className="text-3xl font-black text-orange-500">{streak}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <div className="text-gray-400 text-sm mb-1">Mastered</div>
                    <div className="text-3xl font-black text-indigo-600">{totalMastered}</div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                   <h3 className="font-bold mb-4">Activity</h3>
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis/><Tooltip/><Bar dataKey="itemsLearned" fill="#6366F1" radius={[4,4,0,0]}/></BarChart>
                   </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'manage' && (
              <div className="max-w-5xl w-full mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Vocabulary Library</h2>
                  <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold"><Plus className="w-4 h-4"/> Add Word</button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                      <tr><th className="p-4">Word</th><th className="p-4">Meaning</th><th className="p-4">Score</th><th className="p-4">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {vocab.map(v => (
                        <tr key={v.stt} className="hover:bg-gray-50">
                          <td className="p-4 font-bold">{v.word}</td>
                          <td className="p-4 text-gray-600">{v.meaning}</td>
                          <td className="p-4 text-indigo-600 font-bold">{wordStats[v.stt]?.score || 0}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${wordStats[v.stt]?.score >= 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>
                              {wordStats[v.stt]?.score >= 5 ? 'Mastered' : 'Learning'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Word Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddWord} className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold mb-6">Add New Vocabulary</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Word (e.g. Serendipity)" value={newWord.word} onChange={e => setNewWord({...newWord, word: e.target.value})} className="w-full p-3 border rounded-xl" required />
              <input type="text" placeholder="Meaning (e.g. Sự tình cờ may mắn)" value={newWord.meaning} onChange={e => setNewWord({...newWord, meaning: e.target.value})} className="w-full p-3 border rounded-xl" required />
              <div className="grid grid-cols-2 gap-4">
                <select value={newWord.type} onChange={e => setNewWord({...newWord, type: e.target.value})} className="p-3 border rounded-xl">
                  <option value="noun">Noun</option><option value="verb">Verb</option><option value="adj">Adjective</option>
                </select>
                <input type="text" placeholder="Phonetic" value={newWord.phonetic} onChange={e => setNewWord({...newWord, phonetic: e.target.value})} className="p-3 border rounded-xl" />
              </div>  
              <input type="text" placeholder="Tags (comma separated)" value={newWord.tags} onChange={e => setNewWord({...newWord, tags: e.target.value})} className="w-full p-3 border rounded-xl" />
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-gray-500">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Save Word</button>
            </div>
          </form>
        </div>
      )}

      {/* Settings Modal (Import/Export) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">Backup & Restore</h3>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} className="w-full h-64 p-4 border rounded-xl font-mono text-xs mb-4" />
            <div className="flex gap-4">
              <button onClick={() => setShowSettings(false)} className="px-6 py-2 font-bold text-gray-500">Close</button>
              <button onClick={handleImportJson} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Import JSON</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
