import React from 'react';
import { Lightbulb, Plus, Star, Award, TrendingUp, BookMarked } from 'lucide-react';
import { VocabItem } from '../../services/vocabService';

interface InsightsPanelProps {
  currentSentence: string;
  userVocab: VocabItem[];
  bestScore: number;
  attempts: number;
  onAddWord: (word: string) => void;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({
  currentSentence,
  userVocab,
  bestScore,
  attempts,
  onAddWord
}) => {
  // Simple logic to extract words from sentence
  const words = currentSentence.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(' ');
  const uniqueWords = Array.from(new Set(words.filter(w => w.length > 3)));

  // Identify words already in user's library
  const existingWords = uniqueWords.filter(w => userVocab.some(v => v.word.toLowerCase() === w));
  const newWords = uniqueWords.filter(w => !userVocab.some(v => v.word.toLowerCase() === w));

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Session Stats */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm transition-colors">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-indigo-500" /> Session Insights
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-center">
            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Best Score</div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{bestScore}%</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-center">
            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Attempts</div>
            <div className="text-xl font-bold text-orange-500">{attempts}</div>
          </div>
        </div>
      </div>

      {/* Vocabulary Context */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-indigo-50/30 dark:bg-indigo-900/10">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Context Vocab
          </h3>
          <BookMarked className="w-4 h-4 text-gray-300" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {/* Existing Words */}
          {existingWords.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Award className="w-3 h-3" /> In Your Library
              </p>
              <div className="flex flex-wrap gap-2">
                {existingWords.map(w => (
                  <span key={w} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-100 dark:border-emerald-800">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* New Words Recommendation */}
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Star className="w-3 h-3 text-amber-500" /> New Discoveries
            </p>
            <div className="space-y-2">
              {newWords.length > 0 ? (
                newWords.map(w => (
                  <div key={w} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl group hover:bg-white dark:hover:bg-gray-800 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{w}</span>
                    <button 
                      onClick={() => onAddWord(w)}
                      className="p-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all text-indigo-600 dark:text-indigo-400 hover:scale-110"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-gray-400 italic text-center py-4">No new keywords detected.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/30 text-center">
           <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
             Click words to see definitions (Integrated with System Dictionary)
           </p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(InsightsPanel);
