import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Settings, CheckCircle, XCircle, AlertTriangle, Lightbulb, SearchX, RefreshCcw, BarChart2, BookOpen, Download, Upload, Play, Library, Archive, RotateCcw, Target, Flame, Volume2, ShieldAlert, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, YAxis, CartesianGrid } from 'recharts';
import { diffChars } from 'diff';

type VocabItem = {
  stt: number;
  word: string;
  type: string;
  phonetic: string;
  meaning: string;
  tags?: string[];
  archived?: boolean;
};

type WordStats = {
  score: number;
  attempts: number;
  correct: number;
  incorrect: number;
  typo: number;
  lastSeen?: string;
};

type DayStats = {
  correct: number;
  incorrect: number;
  typo: number;
  total: number;
  mastered: number;
};

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
  
  // Handling Re-type on fail
  const [hasFailedWord, setHasFailedWord] = useState(false);
  const [lastWrongTyped, setLastWrongTyped] = useState('');
  
  const [hintUsed, setHintUsed] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, typo: 0, mistakes: {} as Record<number, number> });
  
  const [showSettings, setShowSettings] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Data
  useEffect(() => {
    const savedVocab = localStorage.getItem('vocab_data_v3');
    if (savedVocab) {
      try { setVocab(JSON.parse(savedVocab)); } catch (e) { setVocab(DEFAULT_VOCAB); }
    } else {
      // Migrate from v2 or v1
      const oldVocab = localStorage.getItem('vocab_data_v2') || localStorage.getItem('vocab_data');
      if (oldVocab) {
        try { 
          const parsed = JSON.parse(oldVocab);
          const normalized = parsed.map((v: any) => ({
            ...v,
            word: v.word || v.en || '',
            meaning: v.meaning || v.vi || '',
            type: v.type || 'unknown',
            phonetic: v.phonetic || ''
          }));
          setVocab(normalized); 
        } catch(e) { setVocab(DEFAULT_VOCAB); }
      } else {
        setVocab(DEFAULT_VOCAB);
      }
    }

    const savedStats = localStorage.getItem('vocab_stats_v3');
    if (savedStats) {
      try { setWordStats(JSON.parse(savedStats)); } catch (e) { setWordStats({}); }
    } else {
      const oldStats = localStorage.getItem('vocab_stats_v2') || localStorage.getItem('vocab_scores');
      if (oldStats) {
        try {
          const parsed = JSON.parse(oldStats);
          const newStats: Record<number, WordStats> = {};
          for (const [k, v] of Object.entries(parsed)) {
            newStats[Number(k)] = typeof v === 'number' 
              ? { score: v, attempts: 0, correct: 0, incorrect: 0, typo: 0 }
              : (v as WordStats);
          }
          setWordStats(newStats);
        } catch(e) {}
      }
    }

    const savedDaily = localStorage.getItem('vocab_daily_v3') || localStorage.getItem('vocab_daily_v2');
    if (savedDaily) {
      try { setDailyStats(JSON.parse(savedDaily)); } catch(e) {}
    }
  }, []);

  // Persist Data
  useEffect(() => {
    if (vocab.length > 0) localStorage.setItem('vocab_data_v3', JSON.stringify(vocab));
  }, [vocab]);
  
  useEffect(() => {
    if (Object.keys(wordStats).length > 0) localStorage.setItem('vocab_stats_v3', JSON.stringify(wordStats));
  }, [wordStats]);

  useEffect(() => {
    if (Object.keys(dailyStats).length > 0) localStorage.setItem('vocab_daily_v3', JSON.stringify(dailyStats));
  }, [dailyStats]);

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

  useEffect(() => {
    if (vocab.length > 0 && status === 'idle' && activeTab === 'quiz') nextWord(vocab, targetVocabList);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, activeTab, selectedTag]);

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
    
    // Choose Mode (50/50) if enough words exist
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

  // Stats Logic Helper
  const applyScoreDelta = useCallback((stt: number, delta: number, resultType: 'correct'|'incorrect'|'typo') => {
    const currentWStats = wordStats[stt] || { score: 0, attempts: 0, correct: 0, incorrect: 0, typo: 0 };
    const newScore = Math.max(0, currentWStats.score + delta);
    const today = getTodayStr();

    setWordStats(prev => ({
      ...prev,
      [stt]: {
        score: newScore,
        attempts: (prev[stt]?.attempts || 0) + 1,
        correct: (prev[stt]?.correct || 0) + (resultType === 'correct' ? 1 : 0),
        incorrect: (prev[stt]?.incorrect || 0) + (resultType === 'incorrect' ? 1 : 0),
        typo: (prev[stt]?.typo || 0) + (resultType === 'typo' ? 1 : 0),
        lastSeen: today
      }
    }));

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

    setDailyStats(prev => {
      const ds = prev[today] || { correct: 0, incorrect: 0, typo: 0, total: 0, mastered: 0 };
      return {
        ...prev,
        [today]: { ...ds,
          correct: ds.correct + (resultType === 'correct' ? 1 : 0),
          incorrect: ds.incorrect + (resultType === 'incorrect' ? 1 : 0),
          typo: ds.typo + (resultType === 'typo' ? 1 : 0),
          total: ds.total + 1
        }
      };
    });
  }, [wordStats]);

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
      setFeedback({ type: isTypo ? 'typo' : 'incorrect', message: isTypo ? "Close! Pay attention to the letters." : "Incorrect. See the differences." });
      setLastWrongTyped(inputValue);
      
      if (!hasFailedWord) {
        applyScoreDelta(currentWord.stt, isTypo ? 0 : -1, isTypo ? 'typo' : 'incorrect');
      }
      setHasFailedWord(true);
      setInputValue(''); // clear so they can type again
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
      setFeedback({ type: 'incorrect', message: `Correct Meaning: ${currentWord.meaning}` });
      applyScoreDelta(currentWord.stt, -1, 'incorrect');
    }
    
    setStatus('answered');
    playAudio(currentWord.word);
  }, [status, quizMode, currentWord, mcqOptions, applyScoreDelta]);

  // Global Keyboard Actions
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Ignore if modals are open or not on quiz tab
      if (showSettings || activeTab !== 'quiz') return;

      // Ctrl + Space -> Hint
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        useHint();
        return;
      }

      // Ctrl + Enter -> Force Next word immediately
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        nextWord();
        return;
      }

      // Enter -> Submit / Next
      if (!e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (status === 'guessing' && quizMode === 'typing') checkTypingAnswer();
        else if (status === 'answered') nextWord();
        return;
      }
      
      // Keys 1-4 for MCQ selection
      if (quizMode === 'mcq' && status === 'guessing' && !e.ctrlKey) {
         const num = parseInt(e.key);
         if (num >= 1 && num <= 4) {
             e.preventDefault();
             handleMcqSelection(num - 1);
         }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [activeTab, status, quizMode, showSettings, useHint, checkTypingAnswer, handleMcqSelection, currentWord, inputValue, nextWord]);

  // UI Computations Dashboard
  const streak = useMemo(() => {
    const days = Object.keys(dailyStats).sort((a,b) => b.localeCompare(a));
    if (days.length === 0) return 0;
    let s = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dailyStats[dStr] && dailyStats[dStr].total > 0) s++;
        else if (i > 0) break;
        d.setDate(d.getDate() - 1);
    }
    return s;
  }, [dailyStats]);

  const totalMastered = useMemo(() => Object.values(wordStats).filter(w => w.score >= 5).length, [wordStats]);
  const sessionTotal = sessionStats.correct + sessionStats.incorrect + sessionStats.typo;
  const sessionAccuracy = sessionTotal > 0 ? Math.round((sessionStats.correct / sessionTotal) * 100) : 0;
  
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  
  const todayStr = getTodayStr();
  const todayStats = dailyStats[todayStr];
  const yesterdayStats = dailyStats[yesterdayStr];
  const todayAcc = todayStats && todayStats.total > 0 ? Math.round((todayStats.correct / todayStats.total) * 100) : 0;
  const yesterAcc = yesterdayStats && yesterdayStats.total > 0 ? Math.round((yesterdayStats.correct / yesterdayStats.total) * 100) : 0;

  const chartData = useMemo(() => {
    const data = [];
    const d = new Date();
    d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const stat = dailyStats[ds];
      data.push({ date: `${d.getMonth()+1}/${d.getDate()}`, itemsLearned: stat ? stat.total : 0 });
      d.setDate(d.getDate() + 1);
    }
    return data;
  }, [dailyStats]);

  const predictionText = useMemo(() => {
    const remaining = 500 - totalMastered;
    if (remaining <= 0) return "Goal achieved! 500+ mastered.";
    const total7 = chartData.reduce((acc, v) => acc + v.itemsLearned, 0);
    const avgPerDay = total7 / 7;
    if (avgPerDay < 1) return "Learn more daily to predict mastery progress!";
    const estimatedDays = Math.ceil((remaining * 5) / avgPerDay);
    return `At current pace, ~${estimatedDays} days to master 500 words.`;
  }, [totalMastered, chartData]);

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].stt !== 'undefined') {
        const newVocab = [...vocab];
        parsed.forEach((newItem: VocabItem) => {
          const mapped = { 
            ...newItem, 
            word: newItem.word || (newItem as any).en || '', 
            meaning: newItem.meaning || (newItem as any).vi || '',
            type: newItem.type || 'unknown',
            phonetic: newItem.phonetic || ''
          };
          const idx = newVocab.findIndex(v => v.stt === mapped.stt);
          if (idx >= 0) newVocab[idx] = { ...newVocab[idx], ...mapped };
          else newVocab.push(mapped as VocabItem);
        });
        setVocab(newVocab);
        setShowSettings(false);
      } else {
        alert('Invalid format. Array expected.');
      }
    } catch(e) { alert('Invalid JSON syntax'); }
  };

  // Calculate Diff Visualization
  const stringDiff = useMemo(() => {
    if (!hasFailedWord || !lastWrongTyped || !currentWord) return null;
    return diffChars(lastWrongTyped.toLowerCase().trim(), currentWord.word.toLowerCase().trim());
  }, [lastWrongTyped, currentWord, hasFailedWord]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans transition-colors duration-200">
      
      {/* Header */}
      <header className="bg-white shadow-sm px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 z-10 relative">
        <div className="flex items-center gap-2 text-indigo-600">
          <BookOpen className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Vocab Learner</h1>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('quiz')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'quiz' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Play className="w-4 h-4" /> Quiz
          </button>
          <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'stats' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <BarChart2 className="w-4 h-4" /> Stats
          </button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'manage' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Library className="w-4 h-4" /> Manage
          </button>
        </div>
        
        <button 
          onClick={() => { setJsonInput(JSON.stringify(vocab, null, 2)); setShowSettings(true); }}
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden md:block"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto flex flex-col">
        {vocab.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
             <SearchX className="w-12 h-12 mb-4 text-gray-300" />
             <p>No vocabulary loaded.</p>
             <button onClick={() => setShowSettings(true)} className="mt-4 text-indigo-600 underline underline-offset-4">Add Vocab Data (JSON)</button>
           </div>
        ) : (
          <>
            {/* QUIZ TAB */}
            {activeTab === 'quiz' && (
              <div className="max-w-3xl w-full mx-auto p-6 flex-1 flex flex-col justify-center">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">Mode:</span>
                    <select 
                      value={selectedTag} 
                      onChange={(e) => setSelectedTag(e.target.value)}
                      className="text-sm font-bold text-indigo-700 bg-indigo-50 border-none rounded-lg focus:ring-0 py-1.5 pl-3 pr-8 cursor-pointer outline-none"
                    >
                      <option value="all">All Words</option>
                      <option value="weakest">🔥 Top 20 Weakest</option>
                      {allTags.map(t => <option key={t} value={t}>Tag: {t}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 font-medium whitespace-nowrap">
                    <div>Controls: <span className="text-indigo-600 bg-indigo-50 px-1.5 rounded font-mono">Enter</span>, <span className="text-indigo-600 bg-indigo-50 px-1.5 rounded font-mono">Ctrl+Enter</span>, <span className="text-indigo-600 bg-indigo-50 px-1.5 rounded font-mono">Ctrl+Space</span></div>
                  </div>
                </div>

                {currentWord ? (
                  <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 p-8 md:p-12 overflow-hidden relative">
                    
                    {quizMode === 'typing' ? (
                      // TYPING MODE UI
                      <>
                        <div className="text-center mb-8">
                          <div className="flex justify-center gap-2 mb-4">
                            {currentWord.tags?.map(t => <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded uppercase tracking-wider">{t}</span>)}
                          </div>
                          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2">
                            {currentWord.meaning}
                          </h2>
                          <div className="flex justify-center items-center gap-3 mt-4">
                             <div className="text-sm font-medium text-gray-400 flex  gap-2 bg-gray-50 px-3 py-1 rounded-full items-center">
                                Score: <span className="text-indigo-600 font-bold">{wordStats[currentWord.stt]?.score || 0}</span>
                             </div>
                             {currentWord.type && <span className="text-sm text-gray-400 font-serif italic">{currentWord.type}</span>}
                          </div>
                        </div>

                        {/* Diff Visualizer for Failed Typo */}
                        {hasFailedWord && stringDiff && (
                          <div className="mb-6 max-w-lg mx-auto bg-gray-50 p-5 BrowserRouternded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2 text-center text-wrap">
                             <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">Compare your mistake</p>
                             <div className="flex flex-wrap gap-[1px] justify-center text-2xl font-mono tracking-widest">
                               {stringDiff.map((part, i) => {
                                  // For diffChars:
                                  // part.added -> in correct word but missed by user -> Highlight Green so they see what they missed.
                                  // part.removed -> typed by user but NOT in correct word -> Highlight Red / crossed out.
                                  if (part.added) return <span key={i} className="text-emerald-700 bg-emerald-100 border-b-2 border-emerald-500 rounded-sm px-[1px]">{part.value}</span>;
                                  if (part.removed) return <span key={i} className="text-rose-500 line-through decoration-2 opacity-50 bg-rose-50 rounded-sm px-[1px]">{part.value}</span>;
                                  return <span key={i} className="text-gray-800 font-bold">{part.value}</span>;
                               })}
                             </div>
                             <p className="mt-6 text-sm text-indigo-600 font-medium">Please re-type the exact word below to continue.</p>
                             <button onClick={(e) => playAudio(currentWord.word, e)} className="mt-4 mx-auto p-2 rounded-full bg-white shadow-sm border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-indigo-600">
                               <Volume2 className="w-5 h-5"/>
                             </button>
                          </div>
                        )}

                        <div className="relative mb-6">
                          <input
                            ref={inputRef} type="text" value={inputValue} 
                            onChange={(e) => setInputValue(e.target.value)} 
                            disabled={status === 'answered'} placeholder="Type the English word..."
                            className={`w-full text-center text-2xl px-6 py-4 rounded-xl border-2 transition-all outline-none 
                              ${status === 'answered' ? 'bg-gray-50 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'}
                              ${feedback?.type === 'correct' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 
                                hasFailedWord ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-200' : 'border-gray-200'}
                            `}
                            autoComplete="off" spellCheck="false" autoFocus
                          />
                        </div>

                        {status === 'answered' && feedback && (
                          <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl mb-6 text-center animate-in fade-in bg-emerald-100 text-emerald-700">
                            <div className="flex items-center gap-2 font-bold text-lg"><CheckCircle className="w-6 h-6"/> Perfect! </div>
                            {currentWord.phonetic && <div className="text-emerald-800 font-mono text-sm">{currentWord.phonetic}</div>}
                          </div>
                        )}

                      </>
                    ) : (
                      // MCQ MODE UI
                      <>
                        <div className="text-center mb-8 relative">
                          <div className="flex justify-center gap-2 mb-3">
                            {currentWord.tags?.map(t => <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded uppercase tracking-wider">{t}</span>)}
                          </div>
                          
                          <div className="flex justify-center items-center gap-4 mb-2">
                             <h2 className="text-4xl md:text-5xl font-extrabold text-indigo-900 tracking-tight leading-tight">
                               {currentWord.word}
                             </h2>
                             <button onClick={(e) => playAudio(currentWord.word, e)} className="p-3 bg-indigo-50 rounded-full text-indigo-600 hover:bg-indigo-100 transition shadow-sm hover:scale-105">
                                <Volume2 className="w-6 h-6" />
                             </button>
                          </div>
                          
                          <div className="flex justify-center gap-4 text-sm font-medium text-gray-500 tracking-wide mt-3 mb-2">
                             {currentWord.phonetic && <span className="font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{currentWord.phonetic}</span>}
                             {currentWord.type && <span className="italic font-serif">{currentWord.type}</span>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                           {mcqOptions.map((opt, idx) => {
                              const isSelected = mcqSelected === idx;
                              const isCorrectAnswer = opt.stt === currentWord.stt;
                              
                              let btnClass = "border-2 border-gray-100 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-gray-800 shadow-sm hover:shadow";
                              if (status === 'answered') {
                                if (isCorrectAnswer) btnClass = "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-md";
                                else if (isSelected && !isCorrectAnswer) btnClass = "border-rose-400 bg-rose-50 text-rose-800 opacity-80";
                                else btnClass = "border-gray-100 bg-white opacity-40";
                              }

                              return (
                                <button
                                  key={idx}
                                  disabled={status === 'answered'}
                                  onClick={() => handleMcqSelection(idx)}
                                  className={`w-full text-left p-5 rounded-xl transition-all duration-200 flex gap-4 items-center focus:outline-none focus:ring-4 focus:ring-indigo-100 ${btnClass}`}
                                >
                                  <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${status === 'answered' && isCorrectAnswer ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                    {idx + 1}
                                  </span>
                                  <span className="text-lg leading-snug font-medium break-words w-full">{opt.meaning}</span>
                                </button>
                              );
                           })}
                        </div>
                      </>
                    )}

                    {/* Shared Controls */}
                    <div className="flex justify-center gap-4 mt-8">
                      {status === 'guessing' && quizMode === 'typing' && !hasFailedWord && (
                        <>
                          <button onClick={useHint} disabled={hintUsed} className="flex-1 py-3 px-6 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Hint (Ctrl+Space)</button>
                        </>
                      )}
                      
                      {status === 'answered' && (
                        <button onClick={() => nextWord()} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition-all shadow-xl flex justify-center items-center gap-2 uppercase tracking-wide">
                          Next Word <span className="opacity-70 text-sm font-normal normal-case break-keep bg-white/20 px-2 py-0.5 rounded ml-1 tracking-normal">Enter</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                    <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900">All caught up!</h3>
                    <p className="text-gray-500 mt-2">You've reached the end of this subset.</p>
                  </div>
                )}
              </div>
            )}

            {/* STATS TAB */}
            {activeTab === 'stats' && (
              <div className="max-w-4xl w-full mx-auto p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="text-gray-400 mb-1 flex items-center gap-1"><Flame className="w-4 h-4"/> Streak</div>
                    <div className="text-4xl font-extrabold text-orange-500">{streak} <span className="text-base font-medium text-gray-400">days</span></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="text-gray-400 mb-1 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Accuracy Today</div>
                    <div className="text-4xl font-extrabold text-emerald-500">
                      {todayAcc}% 
                      {todayAcc > yesterAcc && <span className="text-xs text-emerald-600 ml-2">↑ {todayAcc - yesterAcc}%</span>}
                      {todayAcc < yesterAcc && <span className="text-xs text-rose-600 ml-2">↓ {yesterAcc - todayAcc}%</span>}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="text-gray-400 mb-1 flex items-center gap-1"><Target className="w-4 h-4"/> Mastered</div>
                    <div className="text-4xl font-extrabold text-indigo-600">{totalMastered} <span className="text-base font-medium text-gray-400">/ {vocab.length}</span></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <div className="text-gray-400 mb-2 text-sm uppercase tracking-wide font-semibold">Prediction</div>
                    <div className="text-sm font-medium text-gray-700 bg-gray-50 p-3 rounded-lg w-full leading-snug">{predictionText}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6">Activity Last 7 Days (Attempts)</h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dx={-10} />
                          <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="itemsLearned" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-rose-500" /> Session Mistakes</h3>
                    {Object.keys(sessionStats.mistakes).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-emerald-500 bg-emerald-50 rounded-xl">
                        <CheckCircle className="w-8 h-8 mb-2"/>
                        <span className="font-medium">Perfect Session!</span>
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto max-h-60 pr-2">
                        {Object.entries(sessionStats.mistakes)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([stt, misses]) => {
                            const v = vocab.find(vw => vw.stt === Number(stt));
                            if(!v) return null;
                            return (
                              <div key={stt} className="flex justify-between items-center p-3 bg-red-50 text-red-900 rounded-xl">
                                <div><div className="font-bold">{v.word}</div><div className="text-xs opacity-70">{v.meaning}</div></div>
                                <div className="text-sm font-bold bg-white px-2 py-1 rounded shadow-sm text-red-600">{misses} misses</div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MANAGE TAB */}
            {activeTab === 'manage' && (
              <div className="max-w-5xl w-full mx-auto p-6 flex-1 flex flex-col h-[calc(100vh-80px)]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Vocabulary Library</h2>
                  <div className="flex gap-2">
                    <button onClick={() => {
                        const csv = [
                          ['STT','Word','Meaning','Type','Phonetic','Tags','Score','Attempts','Accuracy','Last Seen'].join(','),
                          ...vocab.map(v => {
                             const st = wordStats[v.stt];
                             const acc = st && st.attempts > 0 ? ((st.correct / st.attempts)*100).toFixed(0)+'%' : '0%';
                             return [v.stt, `"${v.word}"`, `"${v.meaning}"`, v.type, `"${v.phonetic}"`, `"${(v.tags||[]).join(';')}"`, st?.score||0, st?.attempts||0, acc, st?.lastSeen||''].join(',');
                          })
                        ].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'vocab_export.csv'; a.click();
                      }} 
                      className="px-4 py-2 border border-gray-200 text-gray-700 bg-white rounded-lg flex items-center gap-2 hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
                    >
                      <Download className="w-4 h-4"/> Export CSV
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                   <div className="overflow-x-auto flex-1">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs sticky top-0 border-b border-gray-100 z-10">
                         <tr>
                           <th className="px-6 py-4">Word</th>
                           <th className="px-6 py-4">Meaning</th>
                           <th className="px-6 py-4">Phonetic/Type</th>
                           <th className="px-6 py-4">Tags</th>
                           <th className="px-6 py-4">Status</th>
                           <th className="px-6 py-4 text-right">Score</th>
                           <th className="px-6 py-4 text-right">Accuracy</th>
                           <th className="px-6 py-4 text-center">Action</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                         {vocab.map(v => {
                           const st = wordStats[v.stt] || { score: 0, attempts: 0, correct: 0, incorrect: 0, typo: 0 };
                           const acc = st.attempts > 0 ? Math.round((st.correct / st.attempts) * 100) : 0;
                           const statusTag = v.archived ? { l: "Archived", c: "bg-gray-100 text-gray-600" } :
                                             st.score >= 5 ? { l: "Mastered", c: "bg-emerald-100 text-emerald-700" } :
                                             st.score > 0 ? { l: "Learning", c: "bg-blue-100 text-blue-700" } :
                                             { l: "New", c: "bg-purple-100 text-purple-700" };
                           return (
                             <tr key={v.stt} className="hover:bg-gray-50 transition-colors">
                               <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">
                                 {v.word}
                                 <button onClick={(e) => playAudio(v.word, e)} className="text-gray-400 hover:text-indigo-600"><Volume2 className="w-4 h-4"/></button>
                               </td>
                               <td className="px-6 py-4 text-gray-600 font-medium">{v.meaning}</td>
                               <td className="px-6 py-4 text-gray-500 text-xs text-wrap min-w-[120px]">
                                  <div className="font-mono bg-gray-50 inline-block px-1 rounded mb-1">{v.phonetic}</div>
                                  <div className="italic font-serif">{v.type}</div>
                               </td>
                               <td className="px-6 py-4">
                                 <div className="flex gap-1 flex-wrap">
                                    {(v.tags||[]).map(t => <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded uppercase">{t}</span>)}
                                 </div>
                               </td>
                               <td className="px-6 py-4"><span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusTag.c}`}>{statusTag.l}</span></td>
                               <td className="px-6 py-4 text-right font-medium text-indigo-600">{st.score}</td>
                               <td className="px-6 py-4 text-right">
                                 <span className={acc > 80 ? 'text-emerald-600' : acc < 40 && st.attempts > 2 ? 'text-red-500 font-bold' : 'text-gray-500'}>
                                   {st.attempts > 0 ? `${acc}%` : '-'}
                                 </span>
                                 <div className="text-xs text-gray-400 mt-0.5">{st.correct}/{st.attempts}</div>
                               </td>
                               <td className="px-6 py-4 text-center">
                                 <button 
                                   onClick={() => setVocab(vocab.map(item => item.stt === v.stt ? { ...item, archived: !item.archived } : item))}
                                   className={`p-1.5 rounded-md transition-colors ${v.archived ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                                   title={v.archived ? "Restore" : "Archive"}
                                 >
                                   {v.archived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4"/>}
                                 </button>
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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Manage Import / Sync</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-1"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-500 mb-2">Paste JSON data here. Supports `stt`, `word`, `type`, `phonetic`, `meaning`, `tags`.</p>
              <textarea
                value={jsonInput} onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-64 p-4 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none shadow-inner"
                spellCheck="false"
              />
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50 flex justify-between">
              <button 
                onClick={() => {
                  if(window.confirm("This clears ALL your progress data. Sure?")) {
                    setWordStats({}); setDailyStats({}); 
                    localStorage.removeItem('vocab_stats_v3'); localStorage.removeItem('vocab_daily_v3');
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4"/> Clear Stats
              </button>
              
              <div className="flex gap-3">
                <button onClick={() => setShowSettings(false)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleSaveJson} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors">Merge & Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
