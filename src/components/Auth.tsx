import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, Mail, Lock, UserPlus, ShieldCheck } from 'lucide-react';

export default function Auth({ isLoading, user }: { isLoading: boolean, user: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-900 p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-4 rounded-2xl mb-4 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Vocab Learner</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">Your personal English learning companion</p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl mb-6 text-sm font-medium border border-rose-100 dark:border-rose-900/30 animate-in fade-in slide-in-from-top-1">
            <div className="font-bold mb-1">Auth Error:</div>
            {error.includes('configuration-not-found') ? 'Firebase Auth is not enabled in Console. Please enable Email/Google provider.' : error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
            />
          </div>
          
          <button type="submit" className="w-full py-3.5 rounded-xl bg-indigo-600 dark:bg-indigo-600 text-white font-bold hover:bg-indigo-700 dark:hover:bg-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2">
            {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative flex items-center justify-center mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700 w-full"></div>
            <span className="bg-white dark:bg-gray-900 px-4 text-xs text-gray-400 dark:text-gray-500 uppercase font-bold absolute">Or continue with</span>
          </div>

          <button onClick={handleGoogleLogin} className="w-full py-3.5 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-gray-700 dark:text-gray-200 transition-all flex items-center justify-center gap-3">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Google Account
          </button>
        </div>

        <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => setIsRegister(!isRegister)} className="ml-1 text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
