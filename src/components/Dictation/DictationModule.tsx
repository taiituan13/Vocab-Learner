import React, { useState, useEffect } from 'react';
import VideoPanel from './VideoPanel';
import WorkplacePanel from './WorkplacePanel';
import InsightsPanel from './InsightsPanel';
import { useDictationLogic } from '../../hooks/useDictationLogic';
import { TranscriptLine, DictationStats, getDictationStats, saveDictationStats } from '../../services/dictationService';
import { VocabItem } from '../../services/vocabService';

interface DictationModuleProps {
  user: any;
  userVocab: VocabItem[];
  onAddWord: (word: string) => void;
}

// Mock Transcript for Demo
const MOCK_TRANSCRIPT: TranscriptLine[] = [
  { start: 0, end: 5.5, text: "I'm going to tell you a little bit about my TED talk." },
  { start: 5.6, end: 10.2, text: "It's about how we can learn English faster by listening." },
  { start: 10.3, end: 15.8, text: "The most important thing is consistency and practice." },
  { start: 15.9, end: 20.5, text: "Don't be afraid of making mistakes when you speak." }
];

const VIDEO_ID = 'dQw4w9WgXcQ'; // Demo ID, replace with a TED talk ID later

const DictationModule: React.FC<DictationModuleProps> = ({ user, userVocab, onAddWord }) => {
  const [stats, setStats] = useState<DictationStats | null>(null);
  
  const {
    isPlaying,
    currentIndex,
    setCurrentIndex,
    onPlayerReady,
    onPlayerStateChange,
    togglePlayPause,
    seekToSentence,
    replayCurrentSentence
  } = useDictationLogic(MOCK_TRANSCRIPT);

  // Load stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      const data = await getDictationStats(user.uid, VIDEO_ID);
      if (data) setStats(data);
      else {
        setStats({
          videoId: VIDEO_ID,
          title: "Sample TED Talk",
          bestScore: 0,
          attempts: 0,
          lastPracticed: new Date().toISOString(),
          completedSentences: []
        });
      }
    };
    fetchStats();
  }, [user]);

  const handleSuccess = async () => {
    if (!stats || !user) return;
    
    const isAlreadyCompleted = stats.completedSentences.includes(currentIndex);
    const newCompleted = isAlreadyCompleted 
      ? stats.completedSentences 
      : [...stats.completedSentences, currentIndex];
    
    const newStats = {
      ...stats,
      completedSentences: newCompleted,
      attempts: stats.attempts + 1,
      bestScore: Math.floor((newCompleted.length / MOCK_TRANSCRIPT.length) * 100)
    };

    setStats(newStats);
    await saveDictationStats(user.uid, newStats);

    // Auto-advance to next sentence
    if (currentIndex < MOCK_TRANSCRIPT.length - 1) {
      setTimeout(() => {
        seekToSentence(currentIndex + 1);
      }, 500);
    }
  };

  return (
    <div className="max-w-[1600px] w-full mx-auto p-6 h-[calc(100vh-80px)] grid grid-cols-12 gap-6 overflow-hidden">
      {/* Column 1: Video (3/12) */}
      <div className="col-span-12 lg:col-span-3 h-full">
        <VideoPanel
          videoId={VIDEO_ID}
          transcript={MOCK_TRANSCRIPT}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onPlayerReady={onPlayerReady}
          onPlayerStateChange={onPlayerStateChange}
          seekToSentence={seekToSentence}
        />
      </div>

      {/* Column 2: Workplace (6/12) */}
      <div className="col-span-12 lg:col-span-6 h-full">
        <WorkplacePanel
          currentSentence={MOCK_TRANSCRIPT[currentIndex]?.text || ""}
          onSuccess={handleSuccess}
          togglePlayPause={togglePlayPause}
          replayCurrentSentence={replayCurrentSentence}
          isPlaying={isPlaying}
        />
      </div>

      {/* Column 3: Insights (3/12) */}
      <div className="col-span-12 lg:col-span-3 h-full">
        <InsightsPanel
          currentSentence={MOCK_TRANSCRIPT[currentIndex]?.text || ""}
          userVocab={userVocab}
          bestScore={stats?.bestScore || 0}
          attempts={stats?.attempts || 0}
          onAddWord={onAddWord}
        />
      </div>
    </div>
  );
};

export default DictationModule;
