import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, CheckCircle, XCircle, AlertTriangle, Lightbulb, SearchX, RefreshCcw } from 'lucide-react';

type VocabItem = {
  stt: number;
  word: string;
  type: string;
  phonetic: string
  meaning: string;
};

// Default vocabulary set to use as initial data
const DEFAULT_VOCAB: VocabItem[] = [
];

const levenshteinDistance = (a: string, b: string): number => {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  console.log(`Comparing "${s1}" with "${s2}"`);
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
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[s2.length][s1.length];
};

export default function App() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  
  const [currentWord, setCurrentWord] = useState<VocabItem | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'guessing' | 'answered'>('idle');
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect' | 'typo', message?: string } | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize data on mount
  useEffect(() => {
    const savedVocab = localStorage.getItem('vocab_data');
    if (savedVocab) {
      try {
        setVocab(JSON.parse(savedVocab));
      } catch (e) {
        setVocab(DEFAULT_VOCAB);
      }
    } else {
      setVocab(DEFAULT_VOCAB);
      localStorage.setItem('vocab_data', JSON.stringify(DEFAULT_VOCAB));
    }

    const savedScores = localStorage.getItem('vocab_scores');
    if (savedScores) {
      try {
        setScores(JSON.parse(savedScores));
      } catch (e) {
        setScores({});
      }
    }
  }, []);

  // Set the first word when vocab is loaded
  useEffect(() => {
    if (vocab.length > 0 && status === 'idle') {
      nextWord(vocab, scores);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab]);

  const getRandomWord = (vocabList: VocabItem[], scoreDict: Record<number, number>) => {
    if (vocabList.length === 0) return null;
    
    // Weight formula: score 0 -> 100, score 1 -> 50, score 2 -> 33, etc.
    const weights = vocabList.map(item => {
      const score = scoreDict[item.stt] || 0;
      return 100 / (score + 1);
    });
    
    const totalWeight = weights.reduce((acc, val) => acc + val, 0);
    let r = Math.random() * totalWeight;
    
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return vocabList[i];
    }
    return vocabList[vocabList.length - 1];
  };

   // Các dependency cần thiết

  const nextWord = (currentVocab = vocab, currentScores = scores) => {
    const next = getRandomWord(currentVocab, currentScores);
    setCurrentWord(next);
    setInputValue('');
    setStatus('guessing');
    setFeedback(null);
    setHintUsed(false);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (status === 'guessing') {
        checkAnswer();
      } else if (status === 'answered') {
        console.log('Moving to next word via Enter key');
        nextWord();
      }
    }
  };

  const checkAnswer = () => {
    if (!currentWord || !inputValue.trim()) return;

    const dist = levenshteinDistance(currentWord.word, inputValue);
    const targetLength = currentWord.word.length;
    
    // Typo threshold based on length
    // <= 3 chars: exact match required
    // 4 - 6 chars: allow 1 error
    // > 6 chars: allow 2 errors
    const threshold = targetLength <= 3 ? 0 : (targetLength <= 6 ? 1 : 2);
    
    let resultType: 'correct' | 'incorrect' | 'typo';
    
    if (dist === 0) {
      resultType = 'correct';
      setFeedback({ type: 'correct' });
    } else if (dist <= threshold) {
      resultType = 'typo';
      setFeedback({ type: 'typo', message: `Typo! The exact word is "${currentWord.word}".` });
    } else {
      resultType = 'incorrect';
      setFeedback({ type: 'incorrect', message: `Correct word: "${currentWord.word}".` });
    }

    // Update Scores
    const stt = currentWord.stt;
    const currentScore = scores[stt] || 0;
    
    let delta = 0;
    if (resultType === 'correct') {
      delta = hintUsed ? 0 : 1; // +1 if no hint, +0 if used hint
    } else if (resultType === 'typo') {
      delta = 0; // soft fail, score stays the same
    } else {
      delta = -1; // penalty
    }

    const newScore = Math.max(0, currentScore + delta);
    const updatedScores = { ...scores, [stt]: newScore };
    setScores(updatedScores);
    localStorage.setItem('vocab_scores', JSON.stringify(updatedScores));

    setStatus('answered');
  };

  const useHint = () => {
    if (!currentWord || status !== 'guessing') return;
    setHintUsed(true);
    // Reveal half of the word
    const revealCount = Math.max(1, Math.floor(currentWord.word.length / 2));
    const revealedPart = currentWord.word.substring(0, revealCount);
    const hiddenPart = '_ '.repeat(currentWord.word.length - revealCount).trim();
    setInputValue(`${revealedPart}${hiddenPart.replace(/ /g, '')}`); // just replace text directly so user can continue typing or clear
    if (inputRef.current) inputRef.current.focus();
  };

  useEffect(() => {
  const handleGlobalKeyDown = (e) => {
    // 1. Ctrl + Enter để sang từ tiếp theo (Next)
    // Cần kiểm tra status === 'answered' để tránh nhảy từ khi chưa trả lời
    if (e.ctrlKey && e.key === 'Enter') {
      if (status === 'answered') {
        e.preventDefault();
        nextWord();
      }
      return; // Thoát sớm để không dính vào logic Enter đơn thuần bên dưới
    }

    // 2. Enter để kiểm tra đáp án (Submit)
    if (e.key === 'Enter') {
      if (status === 'guessing' && inputValue.trim()) {
        e.preventDefault();
        checkAnswer();
      }
    }

    // 3. Ctrl + Space để dùng gợi ý (Hint)
    if (e.ctrlKey && e.code === 'Space') {
      if (status === 'guessing' && !hintUsed) {
        e.preventDefault();
        useHint();
      }
    }
  };

  window.addEventListener('keydown', handleGlobalKeyDown);

  return () => {
    window.removeEventListener('keydown', handleGlobalKeyDown);
  };
}, [status, inputValue, hintUsed, nextWord, checkAnswer, useHint]);

  

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].stt !== 'undefined') {
        setVocab(parsed);
        localStorage.setItem('vocab_data', JSON.stringify(parsed));
        setShowSettings(false);
        nextWord(parsed, scores);
      } else {
        alert('Invalid format. Array of {stt, en, vi} expected.');
      }
    } catch(e) {
      alert('Invalid JSON syntax');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans transition-colors duration-200">
      
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <div className="flex items-center gap-2 text-indigo-600">
          <Lightbulb className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Vocab Learner</h1>
        </div>
        <button 
          onClick={() => {
            setJsonInput(JSON.stringify(vocab, null, 2));
            setShowSettings(true);
          }}
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:p-10 flex flex-col justify-center">
        
        {vocab.length === 0 ? (
  <div className="text-center text-gray-500 py-12 flex flex-col items-center">
    <SearchX className="w-12 h-12 mb-4 text-gray-300" />
    <p>No vocabulary loaded.</p>
    <button 
      onClick={() => setShowSettings(true)}
      className="mt-4 text-indigo-600 underline underline-offset-4"
    >
      Add Vocab Data (JSON)
    </button>
  </div>
) : currentWord ? (
  <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 p-8 md:p-12 overflow-hidden relative">
    
    <div className="text-center mb-8">
      <div className="flex justify-center items-center gap-2 mb-6">
        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-medium text-xs rounded-full uppercase tracking-widest">
          # {currentWord.stt}
        </span>
        {/* Hiển thị loại từ (adj/v/n...) */}
        <span className="px-3 py-1 bg-gray-100 text-gray-600 font-bold text-xs rounded-full uppercase">
          {currentWord.type}
        </span>
      </div>

      {/* Hiển thị Nghĩa tiếng Việt (Câu hỏi) */}
      <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2">
        {currentWord.meaning}
      </h2>

      {/* Hiển thị Phiên âm (Gợi ý nhỏ phía dưới câu hỏi) */}
      <p className="text-indigo-400 font-mono text-lg mt-2">
        {currentWord.phonetic}
      </p>

      <div className="text-sm font-medium text-gray-400 mt-4 flex items-center justify-center gap-2">
        Score: <span className="text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-lg">{scores[currentWord.stt] || 0}</span>
        {hintUsed && <span className="text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Hint Used</span>}
      </div>
    </div>

    <div className="relative mb-6">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        // onKeyDown={handleKeyDown}
        disabled={status === 'answered'}
        placeholder="Type English word..."
        className={`w-full text-center text-2xl px-6 py-4 rounded-xl border-2 transition-all outline-none 
          ${status === 'answered' ? 'bg-gray-50 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'}
          ${feedback?.type === 'correct' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 
            feedback?.type === 'incorrect' ? 'border-rose-500 text-rose-700 bg-rose-50' : 
            feedback?.type === 'typo' ? 'border-amber-500 text-amber-700 bg-amber-50' : 'border-gray-200'}
        `}
        autoComplete="off"
        spellCheck="false"
      />
    </div>

    {/* Answer Feedbacks */}
    {status === 'answered' && feedback && (
      <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl mb-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300
        ${feedback.type === 'correct' ? 'text-emerald-700 bg-emerald-100' : 
          feedback.type === 'incorrect' ? 'text-rose-700 bg-rose-100' : 'text-amber-700 bg-amber-100'}`}
      >
        <div className="flex items-center gap-2 font-bold text-lg">
          {feedback.type === 'correct' && <><CheckCircle className="w-6 h-6"/> Excellent! </>}
          {feedback.type === 'incorrect' && <><XCircle className="w-6 h-6"/> Not quite. </>}
          {feedback.type === 'typo' && <><AlertTriangle className="w-6 h-6"/> Close! </>}
        </div>
        
        {/* Hiện đáp án đúng khi trả lời xong */}
        <p className="text-2xl font-bold mt-1">
          {currentWord.word}
        </p>
        
        {feedback.message && <p className="font-medium text-base opacity-90">{feedback.message}</p>}
      </div>
    )}

    {/* Controls */}
    <div className="flex justify-center gap-4 mt-8">
      {status === 'guessing' ? (
        <>
          <button 
            onClick={useHint}
            disabled={hintUsed}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hint
          </button>
          <button 
            onClick={checkAnswer}
            disabled={!inputValue.trim()}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
          >
            Submit <span className="hidden sm:inline-block ml-1 opacity-70 text-xs font-normal">(&crarr;)</span>
          </button>
        </>
      ) : (
        <button 
          onClick={() => nextWord()}
          className="w-full py-4 px-6 rounded-xl font-bold text-white bg-gray-900 hover:bg-black focus:ring-4 focus:ring-gray-900/40 transition-all shadow-xl shadow-gray-900/20 flex justify-center items-center gap-2 uppercase tracking-wide"
        >
          Next Word <span className="opacity-70 text-sm font-normal normal-case">&crarr;</span>
        </button>
      )}
    </div>

  </div>
) : null}

      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Update Vocabulary Data</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">
                Paste your custom <code>vocab.json</code> here. Ensure it's an array of objects containing <code>stt</code>, <code>en</code>, and <code>vi</code> properties. Your scores will merge based on the unique <code>stt</code>.
              </p>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-80 p-4 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none shadow-inner"
                spellCheck="false"
              />
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setJsonInput(JSON.stringify(DEFAULT_VOCAB, null, 2));
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <RefreshCcw className="w-4 h-4"/> Reset to Default
              </button>
              <button 
                onClick={() => setShowSettings(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveJson}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors"
              >
                Save & Restart
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
