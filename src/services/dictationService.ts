import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export interface DictationStats {
  videoId: string;
  title: string;
  bestScore: number;
  attempts: number;
  lastPracticed: string;
  completedSentences: number[];
}

export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
}

export const getDictationStats = async (userId: string, videoId: string): Promise<DictationStats | null> => {
  const docRef = doc(db, `users/${userId}/dictation_stats/${videoId}`);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as DictationStats;
  }
  return null;
};

export const getAllDictationHistory = async (userId: string): Promise<DictationStats[]> => {
  const colRef = collection(db, `users/${userId}/dictation_stats`);
  const querySnapshot = await getDocs(colRef);
  const history: DictationStats[] = [];
  
  querySnapshot.forEach((doc) => {
    history.push(doc.data() as DictationStats);
  });
  
  return history;
};

export const saveDictationStats = async (userId: string, stats: DictationStats): Promise<void> => {
  const docRef = doc(db, `users/${userId}/dictation_stats/${stats.videoId}`);
  await setDoc(docRef, {
    ...stats,
    lastPracticed: new Date().toISOString()
  }, { merge: true });
};
