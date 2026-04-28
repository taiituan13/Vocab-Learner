import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Settings, SearchX, BarChart2, BookOpen, Play, Library, Volume2, Trash2, LogOut, Plus, ChevronDown, Sun, Moon, Info, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, YAxis, CartesianGrid } from 'recharts';
import { diffChars } from 'diff';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import AddModal from './components/AddModal';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { 
  getVocabulary, saveVocabulary, 
  getWordStats, saveWordStats, 
  getDailyStats, saveDailyStats, 
  VocabItem, WordStats, DayStats 
} from './services/vocabService';

interface DictionaryInfo {
  phonetic?: string;
  definition?: string;
  partOfSpeech?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
  sourceUrl?: string;
}

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
  
  const [dictionaryInfo, setDictionaryInfo] = useState<DictionaryInfo | null>(null);

  // UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Apply Theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Management States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [editingWord, setEditingWord] = useState<VocabItem | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDictionaryInfo = async (word: string) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.length > 0) {
        const entry = data[0];
        const meaning = entry.meanings[0];
        const def = meaning.definitions[0];
        
        setDictionaryInfo({
          phonetic: entry.phonetic || (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text),
          definition: def.definition,
          partOfSpeech: meaning.partOfSpeech,
          example: def.example,
          synonyms: def.synonyms?.slice(0, 3) || meaning.synonyms?.slice(0, 3),
          antonyms: def.antonyms?.slice(0, 3) || meaning.antonyms?.slice(0, 3),
          sourceUrl: entry.sourceUrls?.[0]
        });
      }
    } catch (e) {
      console.error("Error fetching dictionary info:", e);
    }
  };

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

  // Sync Data to Firestore
  const syncVocab = useCallback(async (newVocab: VocabItem[]) => {
    if (user) {
      setVocab(newVocab);
      await saveVocabulary(user.uid, newVocab);
    }
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
    setDictionaryInfo(null);
    
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
      fetchDictionaryInfo(currentWord.word);
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
    fetchDictionaryInfo(currentWord.word);
  }, [status, quizMode, currentWord, mcqOptions, applyScoreDelta]);

  // Keyboard Handlers
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (showAddModal || activeTab !== 'quiz') return;
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
  }, [activeTab, status, quizMode, showAddModal, useHint, checkTypingAnswer, handleMcqSelection, nextWord]);

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
        
        <div className="flex items-center gap-4 relative">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-1.5 bg-white border border-gray-100 rounded-full hover:bg-gray-50 transition-all shadow-sm group"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs shadow-inner">
              {user?.displayName?.[0] || user?.email?.[0]}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Welcome</span>
              <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">
                {user?.displayName || user?.email?.split('@')[0]}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-3xl shadow-2xl shadow-indigo-200/50 border border-gray-50 py-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-6 py-4 border-b border-gray-50 mb-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Signed in as</p>
                <p className="text-sm font-bold text-gray-800 truncate">{user?.email}</p>
              </div>

              <div className="px-4 mb-3">
                <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                  <div className="text-center flex-1">
                    <div className="text-orange-500 font-black text-lg leading-none mb-1">{streak}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase">Streak</div>
                  </div>
                  <div className="w-[1px] h-8 bg-gray-200"></div>
                  <div className="text-center flex-1">
                    <div className="text-indigo-600 font-black text-lg leading-none mb-1">{totalMastered}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase">Mastered</div>
                  </div>
                </div>
              </div>

              <div className="px-2 space-y-1">
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    {darkMode ? <Sun className="w-4 h-4 text-amber-500"/> : <Moon className="w-4 h-4 text-indigo-500"/>}
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${darkMode ? 'bg-amber-400' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </button>

                <div className="h-[1px] bg-gray-50 my-2 mx-4"></div>

                <button 
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
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
                    {status === 'answered' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Correct Answer Header for Typing Mode */}
                        {/* {quizMode === 'typing' && !feedback?.message && (
                          <div className="flex flex-col items-center mb-6">
                            <span className="text-emerald-500 font-black text-6xl mb-2">✓</span>
                            <h3 className="text-3xl font-bold text-emerald-600">{currentWord.word}</h3>
                          </div>
                        )} */}

                        {dictionaryInfo ? (
                          <div className="bg-gray-50 rounded-3xl p-6 md:p-8 text-left border border-gray-100 shadow-inner">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                              <div className="flex items-center gap-2 text-gray-400 font-mono italic">
                                {dictionaryInfo.phonetic}
                                <button onClick={() => playAudio(currentWord.word)} className="p-2 hover:bg-white rounded-full transition-colors">
                                  <Volume2 className="w-5 h-5 text-indigo-500" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                  <Info className="w-3.5 h-3.5" /> Definition
                                </p>
                                <p className="text-gray-700 leading-relaxed font-medium">
                                  {dictionaryInfo.definition}
                                </p>
                              </div>

                              {dictionaryInfo.example && (
                                <div className="pl-4 border-l-4 border-indigo-100">
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Example</p>
                                  <p className="text-gray-600 italic">"{dictionaryInfo.example}"</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {dictionaryInfo.synonyms && dictionaryInfo.synonyms.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Synonyms</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {dictionaryInfo.synonyms.map(s => (
                                        <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] rounded-md border border-emerald-100 font-medium">{s}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {dictionaryInfo.antonyms && dictionaryInfo.antonyms.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1.5">Antonyms</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {dictionaryInfo.antonyms.map(a => (
                                        <span key={a} className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[11px] rounded-md border border-rose-100 font-medium">{a}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {dictionaryInfo.sourceUrl && (
                                <div className="pt-2">
                                  <a href={dictionaryInfo.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-widest">
                                    Full Details <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 animate-pulse flex flex-col items-center">
                            <div className="h-4 w-48 bg-gray-100 rounded-full mb-4"></div>
                            <div className="h-4 w-32 bg-gray-50 rounded-full"></div>
                          </div>
                        )}
                        
                        <button onClick={() => nextWord()} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2">
                          Next Word <Play className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
              <div className="max-w-6xl w-full mx-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">Vocabulary Library</h2>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                       <SearchX className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                       <input 
                         type="text" placeholder="Search word or meaning..." 
                         value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                    </div>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="all">All Types</option>
                      <option value="noun">Noun</option>
                      <option value="verb">Verb</option>
                      <option value="adj">Adjective</option>
                    </select>
                    <button 
                      onClick={() => { setEditingWord(null); setShowAddModal(true); }} 
                      className="bg-indigo-600 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                    >
                      <Plus className="w-5 h-5"/> Add Word
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="p-5">Word</th>
                          <th className="p-5">Meaning</th>
                          <th className="p-5">Stats</th>
                          <th className="p-5">Status</th>
                          <th className="p-5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {vocab
                          .filter(v => 
                            (v.word.toLowerCase().includes(searchTerm.toLowerCase()) || v.meaning.toLowerCase().includes(searchTerm.toLowerCase())) &&
                            (filterType === 'all' || v.type === filterType)
                          )
                          .map(v => {
                            const stats = wordStats[v.stt] || { score: 0, attempts: 0 };
                            const isMastered = stats.score >= 5;
                            return (
                              <tr key={v.stt} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="p-5">
                                  <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                    {v.word}
                                    <button onClick={() => playAudio(v.word)} className="text-gray-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"><Volume2 className="w-4 h-4"/></button>
                                  </div>
                                  <div className="text-xs text-gray-400 font-mono">{v.phonetic} • {v.type}</div>
                                </td>
                                <td className="p-5 text-gray-600 font-medium">{v.meaning}</td>
                                <td className="p-5">
                                  <div className="text-sm font-bold text-indigo-600">{stats.score} pts</div>
                                  <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{stats.attempts} attempts</div>
                                </td>
                                <td className="p-5">
                                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${isMastered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isMastered ? 'Mastered' : 'Learning'}
                                  </span>
                                </td>
                                <td className="p-5">
                                  <div className="flex justify-center gap-2">
                                    <button 
                                      onClick={() => { 
                                        setEditingWord(v); 
                                        setShowAddModal(true); 
                                      }}
                                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    >
                                      <Settings className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm(`Delete "${v.word}"?`)) {
                                          const newVocab = vocab.filter(item => item.stt !== v.stt);
                                          await syncVocab(newVocab);
                                        }
                                      }}
                                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer / Credit */}
      <footer className="bg-white border-t border-gray-100 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-600">Vocab Learner Pro</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-1">
            Developed with <span className="text-rose-500 text-lg">♥</span> by 
            <a href="https://github.com/taiituan13" target="_blank" rel="noopener noreferrer" className="font-bold text-gray-800 hover:text-indigo-600 transition-colors ml-1">
              Nguyen Tuan Tai
            </a>
          </div>
          <div className="flex gap-4">
            <a href="https://github.com/taiituan13/Vocab-Learner" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">Open Source</a>
            <span className="opacity-30">|</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </footer>

      <AddModal 
        isOpen={showAddModal} 
        onClose={() => { setShowAddModal(false); setEditingWord(null); }}
        vocab={vocab}
        editingWord={editingWord}
        onSuccess={syncVocab}
      />
    </div>
  );
}
