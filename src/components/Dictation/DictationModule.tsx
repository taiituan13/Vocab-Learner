import React, { useState, useEffect } from 'react';
import VideoPanel from './VideoPanel';
import WorkplacePanel from './WorkplacePanel';
import InsightsPanel from './InsightsPanel';
import DictationDashboard from './DictationDashboard';
import { useDictationLogic } from '../../hooks/useDictationLogic';
import { TranscriptLine, DictationStats, getDictationStats, saveDictationStats } from '../../services/dictationService';
import { YouTubeVideo } from '../../services/youtubeService';
import { VocabItem } from '../../services/vocabService';
import { ArrowLeft } from 'lucide-react';

interface DictationModuleProps {
  user: any;
  userVocab: VocabItem[];
  onAddWord: (word: string) => void;
}

// Mock Transcript for Demo (Will be replaced by real fetching logic later)
const GET_MOCK_TRANSCRIPT = (videoId: string): TranscriptLine[] => [
  { start: 0, end: 5.5, text: "I'm going to tell you a little bit about this TED talk." },
  { start: 5.6, end: 10.2, text: "It's about how we can learn English faster by listening." },
  { start: 10.3, end: 15.8, text: "The most important thing is consistency and practice." },
  { start: 15.9, end: 20.5, text: "Don't be afraid of making mistakes when you speak." }
];

const DictationModule: React.FC<DictationModuleProps> = ({ user, userVocab, onAddWord }) => {
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [stats, setStats] = useState<DictationStats | null>(null);
  
  // Logic is only active when a video is selected
  const {
    isPlaying,
    currentIndex,
    setCurrentIndex,
    onPlayerReady,
    onPlayerStateChange,
    togglePlayPause,
    seekToSentence,
    replayCurrentSentence
  } = useDictationLogic(selectedVideo ? GET_MOCK_TRANSCRIPT(selectedVideo.id) : []);

  // Load stats when video is selected
  useEffect(() => {
    const fetchStats = async () => {
      if (!user || !selectedVideo) return;
      const data = await getDictationStats(user.uid, selectedVideo.id);
      if (data) setStats(data);
      else {
        setStats({
          videoId: selectedVideo.id,
          title: selectedVideo.title,
          bestScore: 0,
          attempts: 0,
          lastPracticed: new Date().toISOString(),
          completedSentences: []
        });
      }
    };
    fetchStats();
  }, [user, selectedVideo]);

  const handleSuccess = async () => {
    if (!stats || !user || !selectedVideo) return;
    
    const transcript = GET_MOCK_TRANSCRIPT(selectedVideo.id);
    const isAlreadyCompleted = stats.completedSentences.includes(currentIndex);
    const newCompleted = isAlreadyCompleted 
      ? stats.completedSentences 
      : [...stats.completedSentences, currentIndex];
    
    const newStats = {
      ...stats,
      completedSentences: newCompleted,
      attempts: stats.attempts + 1,
      bestScore: Math.floor((newCompleted.length / transcript.length) * 100)
    };

    setStats(newStats);
    await saveDictationStats(user.uid, newStats);

    // Auto-advance to next sentence
    if (currentIndex < transcript.length - 1) {
      setTimeout(() => {
        seekToSentence(currentIndex + 1);
      }, 500);
    }
  };

  if (!selectedVideo) {
    return <DictationDashboard userId={user?.uid} onSelectVideo={setSelectedVideo} />;
  }

  const transcript = GET_MOCK_TRANSCRIPT(selectedVideo.id);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Mini Header for Workplace */}
      <div className="px-6 py-3 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between transition-colors">
        <button 
          onClick={() => setSelectedVideo(null)}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </button>
        <h2 className="text-sm font-black text-gray-900 dark:text-white truncate max-w-md">
          {selectedVideo.title}
        </h2>
        <div className="w-24"></div> {/* Spacer */}
      </div>

      <div className="max-w-[1600px] w-full mx-auto p-6 flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Column 1: Video (3/12) */}
        <div className="col-span-12 lg:col-span-3 h-full overflow-hidden">
          <VideoPanel
            videoId={selectedVideo.id}
            transcript={transcript}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onPlayerReady={onPlayerReady}
            onPlayerStateChange={onPlayerStateChange}
            seekToSentence={seekToSentence}
          />
        </div>

        {/* Column 2: Workplace (6/12) */}
        <div className="col-span-12 lg:col-span-6 h-full overflow-hidden">
          <WorkplacePanel
            currentSentence={transcript[currentIndex]?.text || ""}
            onSuccess={handleSuccess}
            togglePlayPause={togglePlayPause}
            replayCurrentSentence={replayCurrentSentence}
            isPlaying={isPlaying}
          />
        </div>

        {/* Column 3: Insights (3/12) */}
        <div className="col-span-12 lg:col-span-3 h-full overflow-hidden">
          <InsightsPanel
            currentSentence={transcript[currentIndex]?.text || ""}
            userVocab={userVocab}
            bestScore={stats?.bestScore || 0}
            attempts={stats?.attempts || 0}
            onAddWord={onAddWord}
          />
        </div>
      </div>
    </div>
  );
};

export default DictationModule;
