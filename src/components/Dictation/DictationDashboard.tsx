import React, { useState, useEffect } from 'react';
import { Play, Calendar, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchTedVideos, YouTubeVideo } from '../../services/youtubeService';

interface DictationDashboardProps {
  userId: string;
  onSelectVideo: (video: YouTubeVideo) => void;
}

const DictationDashboard: React.FC<DictationDashboardProps> = ({ userId, onSelectVideo }) => {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTedVideos(userId);
      setVideos(data);
    } catch (err) {
      setError('Failed to load videos. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4 animate-pulse"></div>
                <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">TED Talks Dashboard</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Select a talk to start your dictation practice</p>
          </div>
          <button 
            onClick={() => loadVideos(true)}
            className="p-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-gray-400 hover:text-indigo-600"
            title="Refresh list"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </header>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 p-6 rounded-3xl flex items-center gap-4 mb-8">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <p className="text-rose-700 dark:text-rose-300 font-bold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map((video) => (
            <div 
              key={video.id}
              className="group bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video overflow-hidden p-3">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                   <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-indigo-600 shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="w-6 h-6 fill-current" />
                   </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-2 text-lg mb-4 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {video.title}
                </h3>
                
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {new Date(video.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => onSelectVideo(video)}
                    className="px-5 py-2 bg-gray-50 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm group/btn"
                  >
                    Practice Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {videos.length === 0 && !loading && (
          <div className="py-20 text-center">
            <Play className="w-16 h-16 mx-auto text-gray-200 dark:text-gray-800 mb-4" />
            <p className="text-gray-400 font-medium">No videos found in library.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DictationDashboard;
