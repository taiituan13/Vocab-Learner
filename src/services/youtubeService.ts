import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || ''; 
const TED_CHANNEL_ID = 'UCAuUUnT6oDeKwE6v1NGQxug'; // Main TED channel
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

export const fetchTedVideos = async (userId: string): Promise<YouTubeVideo[]> => {
  if (!userId) return [];

  const cacheRef = doc(db, `users/${userId}/dictation_cache/ted_videos`);
  
  try {
    const cacheSnap = await getDoc(cacheRef);

    if (cacheSnap.exists()) {
      const data = cacheSnap.data();
      const now = Date.now();
      if (data.lastUpdated && (now - data.lastUpdated < CACHE_EXPIRATION_MS)) {
        console.log('Returning TED videos from Firestore cache');
        return data.videos as YouTubeVideo[];
      }
    }
  } catch (e) {
    console.error("Error checking cache:", e);
  }

  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API Key is missing. Falling back to mock data.');
    return getMockTedVideos();
  }

  try {
    console.log('Fetching new TED videos from YouTube API...');
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${TED_CHANNEL_ID}&part=snippet,id&order=date&maxResults=15&type=video`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch from YouTube API');
    }

    const data = await response.json();
    const videos: YouTubeVideo[] = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      thumbnail: item.snippet.thumbnails.high.url || item.snippet.thumbnails.default.url,
      publishedAt: item.snippet.publishedAt,
    }));

    // Save to cache
    await setDoc(cacheRef, {
      videos,
      lastUpdated: Date.now()
    });

    return videos;
  } catch (error) {
    console.error('Error fetching TED videos:', error);
    return getMockTedVideos();
  }
};

const getMockTedVideos = (): YouTubeVideo[] => {
  return [
    {
      id: 'dQw4w9WgXcQ',
      title: 'How we can learn English faster by listening | Sample TED Talk',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date().toISOString()
    },
    {
      id: 'RKK7wGAYP6k', 
      title: 'The power of vulnerability | Brené Brown',
      thumbnail: 'https://img.youtube.com/vi/RKK7wGAYP6k/hqdefault.jpg',
      publishedAt: new Date().toISOString()
    },
    {
      id: 'iCvmsMzlF7o', 
      title: 'The power of introverts | Susan Cain',
      thumbnail: 'https://img.youtube.com/vi/iCvmsMzlF7o/hqdefault.jpg',
      publishedAt: new Date().toISOString()
    }
  ];
};
