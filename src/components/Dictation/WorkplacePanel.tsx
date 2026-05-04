import React, { useState, useEffect, useRef } from 'react';
import { Headphones, CheckCircle2, AlertCircle, Play, Pause, RotateCcw, Keyboard } from 'lucide-react';
import { diffChars } from 'diff';

interface WorkplacePanelProps {
  currentSentence: string;
  onSuccess: () => void;
  togglePlayPause: () => void;
  replayCurrentSentence: () => void;
  isPlaying: boolean;
}

const WorkplacePanel: React.FC<WorkplacePanelProps> = ({
  currentSentence,
  onSuccess,
  togglePlayPause,
  replayCurrentSentence,
  isPlaying
}) => {
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ added?: boolean; removed?: boolean; value: string }[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when video pauses (auto-pause logic)
  useEffect(() => {
    if (!isPlaying) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isPlaying]);

  const checkAnswer = () => {
    const normalizedTarget = currentSentence.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const normalizedInput = inputValue.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();

    const diff = diffChars(normalizedInput, normalizedTarget);
    setFeedback(diff);

    if (normalizedInput === normalizedTarget) {
      setTimeout(() => {
        setInputValue('');
        setFeedback(null);
        onSuccess();
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      checkAnswer();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      replayCurrentSentence();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
      {/* Workspace Header */}
      <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-500" /> Dictation Workspace
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">
            Listen and type exactly what you hear
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={replayCurrentSentence} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-xl transition-all text-gray-400 hover:text-indigo-500 shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
             <RotateCcw className="w-4 h-4" />
           </button>
           <button onClick={togglePlayPause} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">
             {isPlaying ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Play</>}
           </button>
        </div>
      </div>

      {/* Main Interaction Area */}
      <div className="flex-1 p-8 flex flex-col gap-6">
        {/* Feedback Display */}
        <div className="min-h-[120px] p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-center relative overflow-hidden">
          {!feedback ? (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Headphones className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium italic">Wait for the video to pause, then start typing...</p>
            </div>
          ) : (
            <div className="text-xl font-medium leading-relaxed tracking-wide">
              {feedback.map((part, i) => (
                <span 
                  key={i} 
                  className={`${
                    part.added 
                      ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' 
                      : part.removed 
                        ? 'text-rose-500 dark:text-rose-400 line-through' 
                        : 'text-gray-800 dark:text-gray-200'
                  } px-0.5 rounded transition-colors duration-300`}
                >
                  {part.value}
                </span>
              ))}
            </div>
          )}
          
          {/* Status Indicator */}
          {feedback && feedback.every(p => !p.removed && !p.added) && (
            <div className="absolute top-4 right-4 animate-bounce">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-1 flex flex-col gap-4">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type here..."
            className="flex-1 w-full p-6 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-3xl focus:border-indigo-500 dark:focus:border-indigo-400 outline-none text-lg resize-none shadow-inner transition-all dark:text-white"
          />
          
          <div className="flex justify-between items-center px-2">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ctrl + Enter: Check</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Esc: Replay</span>
              </div>
            </div>
            
            <button 
              onClick={checkAnswer}
              disabled={!inputValue.trim()}
              className="px-8 py-3 bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-black dark:hover:bg-indigo-700 transition-all disabled:opacity-30 flex items-center gap-2"
            >
              Verify <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(WorkplacePanel);
