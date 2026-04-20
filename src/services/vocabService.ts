import { db } from '../firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';

export type VocabItem = {
  stt: number;
  word: string;
  type: string;
  phonetic: string;
  meaning: string;
  tags?: string[];
  archived?: boolean;
};

export type WordStats = {
  score: number;
  attempts: number;
  correct: number;
  incorrect: number;
  typo: number;
  lastSeen?: string;
};

export type DayStats = {
  correct: number;
  incorrect: number;
  typo: number;
  total: number;
  mastered: number;
};

export const getVocabulary = async (userId: string): Promise<VocabItem[]> => {
  const docRef = doc(db, `users/${userId}/vocabulary/data`);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return (docSnap.data().items as VocabItem[]) || [];
  }
  return [];
};

export const saveVocabulary = async (userId: string, vocab: VocabItem[]): Promise<void> => {
    const docRef = doc(db, `users/${userId}/vocabulary/data`);
    await setDoc(docRef, { items: vocab });
};

export const getWordStats = async (userId: string): Promise<Record<number, WordStats>> => {
  const docRef = doc(db, `users/${userId}/wordStats/data`);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return (docSnap.data() as Record<number, WordStats>) || {};
  }
  return {};
};

export const saveWordStats = async (userId: string, wordStats: Record<number, WordStats>): Promise<void> => {
    const docRef = doc(db, `users/${userId}/wordStats/data`);
    await setDoc(docRef, wordStats);
};

export const getDailyStats = async (userId: string): Promise<Record<string, DayStats>> => {
  const docRef = doc(db, `users/${userId}/dailyStats/data`);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return (docSnap.data() as Record<string, DayStats>) || {};
  }
  return {};
};

export const saveDailyStats = async (userId: string, dailyStats: Record<string, DayStats>): Promise<void> => {
    const docRef = doc(db, `users/${userId}/dailyStats/data`);
    await setDoc(docRef, dailyStats);
};
