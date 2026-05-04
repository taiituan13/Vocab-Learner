import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptLine } from '../services/dictationService';

export const useDictationLogic = (transcript: TranscriptLine[]) => {
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPause, setIsAutoPause] = useState(true);
  const [isSmartLoop, setIsSmartLoop] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const onPlayerReady = (event: any) => {
    setPlayer(event.target);
  };

  const onPlayerStateChange = (event: any) => {
    // 1 = Playing, 2 = Paused, 0 = Ended
    if (event.data === 1) setIsPlaying(true);
    else setIsPlaying(false);
  };

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  }, [player, isPlaying]);

  const seekToSentence = useCallback((index: number) => {
    if (!player || !transcript[index]) return;
    setCurrentIndex(index);
    player.seekTo(transcript[index].start, true);
    player.playVideo();
  }, [player, transcript]);

  const replayCurrentSentence = useCallback(() => {
    seekToSentence(currentIndex);
  }, [seekToSentence, currentIndex]);

  // Sync Logic (The "Brain")
  useEffect(() => {
    if (isPlaying && player) {
      timerRef.current = setInterval(() => {
        const time = player.getCurrentTime();
        setCurrentTime(time);

        const currentSentence = transcript[currentIndex];
        if (currentSentence && time >= currentSentence.end) {
          if (isAutoPause) {
            player.pauseVideo();
            
            if (isSmartLoop) {
              player.seekTo(currentSentence.start, true);
              player.playVideo();
            }
          }
        }
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, player, currentIndex, transcript, isAutoPause, isSmartLoop]);

  return {
    player,
    isPlaying,
    currentIndex,
    setCurrentIndex,
    currentTime,
    isAutoPause,
    setIsAutoPause,
    isSmartLoop,
    setIsSmartLoop,
    onPlayerReady,
    onPlayerStateChange,
    togglePlayPause,
    seekToSentence,
    replayCurrentSentence
  };
};
