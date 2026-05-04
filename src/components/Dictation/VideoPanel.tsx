import React from 'react';
import YouTube from 'react-youtube';
import { Play, Pause, RotateCcw, ChevronRight } from 'lucide-react';
import { TranscriptLine } from '../../services/dictationService';

interface VideoPanelProps {
  videoId: string;
  transcript: TranscriptLine[];
  currentIndex: number;
  isPlaying: boolean;
  onPlayerReady: (event: any) => void;
  onPlayerStateChange: (event: any) => void;
  seekToSentence: (index: number) => void;
}

const VideoPanel: React.FC<VideoPanelProps> = ({
  videoId,
  transcript,
  currentIndex,
  isPlaying,
  onPlayerReady,
  onPlayerStateChange,
  seekToSentence
}) => {
  const opts = {
    height: '240',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* YouTube Player Container */}
      <div className="overflow-hidden rounded-3xl bg-black aspect-video shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onPlayerReady}
          onStateChange={onPlayerStateChange}
          className="w-full h-full"
        />
      </div>

      {/* Transcript Timeline */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-indigo-500" /> Timeline
          </h3>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {currentIndex + 1} / {transcript.length}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {transcript.map((line, index) => (
            <button
              key={index}
              onClick={() => seekToSentence(index)}
              className={`w-full text-left p-3 rounded-2xl transition-all group flex items-start gap-3 ${
                index === currentIndex
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
              } border`}
            >
              <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                index === currentIndex ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                <span className="text-[10px] font-bold">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${
                  index === currentIndex ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {line.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-mono text-gray-400">
                    {Math.floor(line.start)}s - {Math.floor(line.end)}s
                  </span>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 mt-1 transition-all ${
                index === currentIndex ? 'text-indigo-400 opacity-100 translate-x-0' : 'text-gray-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
              }`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoPanel);
