import React, { useState, useEffect } from 'react';
import { XCircle, Plus, Upload, Download, RefreshCcw, Lightbulb, AlertTriangle } from 'lucide-react';
import { VocabItem } from '../services/vocabService';

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  vocab: VocabItem[];
  editingWord: VocabItem | null;
  onSuccess: (newVocab: VocabItem[]) => Promise<void>;
}

const AddModal: React.FC<AddModalProps> = ({ isOpen, onClose, vocab, editingWord, onSuccess }) => {
  const [dataTab, setDataTab] = useState<'single' | 'import' | 'export'>('single');
  const [newWord, setNewWord] = useState({ word: '', meaning: '', type: 'noun', phonetic: '', tags: '' });
  const [isFetching, setIsFetching] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    if (editingWord) {
      setNewWord({
        word: editingWord.word,
        meaning: editingWord.meaning,
        type: editingWord.type,
        phonetic: editingWord.phonetic || '',
        tags: (editingWord.tags || []).join(', ')
      });
      setDataTab('single');
    } else {
      setNewWord({ word: '', meaning: '', type: 'noun', phonetic: '', tags: '' });
    }
  }, [editingWord, isOpen]);

  useEffect(() => {
    if (dataTab === 'export') {
      setJsonInput(JSON.stringify(vocab, null, 2));
    }
  }, [dataTab, vocab]);

  if (!isOpen) return null;

  const fetchWordDetails = async (wordToFetch: string) => {
    if (!wordToFetch.trim()) return;
    setIsFetching(true);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${wordToFetch.trim().toLowerCase()}`);
      if (!response.ok) throw new Error('Word not found');
      const data = await response.json();
      
      if (data && data.length > 0) {
        const entry = data[0];
        const phonetic = entry.phonetic || (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text) || '';
        const firstMeaning = entry.meanings[0];
        const partOfSpeech = firstMeaning?.partOfSpeech || 'noun';
        const definition = firstMeaning?.definitions[0]?.definition || '';

        setNewWord(prev => ({
          ...prev,
          phonetic: phonetic || prev.phonetic,
          type: partOfSpeech || prev.type,
          meaning: definition || prev.meaning,
        }));
      }
    } catch (error) {
      console.error("Error fetching word details:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    let newVocabList: VocabItem[];

    if (editingWord) {
      newVocabList = vocab.map(v => v.stt === editingWord.stt ? {
        ...v,
        word: newWord.word.trim(),
        meaning: newWord.meaning.trim(),
        type: newWord.type,
        phonetic: newWord.phonetic.trim(),
        tags: newWord.tags.split(',').map(t => t.trim()).filter(t => t)
      } : v);
    } else {
      const stt = vocab.length > 0 ? Math.max(...vocab.map(v => v.stt)) + 1 : 1;
      const item: VocabItem = {
        stt,
        word: newWord.word.trim(),
        meaning: newWord.meaning.trim(),
        type: newWord.type,
        phonetic: newWord.phonetic.trim(),
        tags: newWord.tags.split(',').map(t => t.trim()).filter(t => t),
        archived: false
      };
      newVocabList = [...vocab, item];
    }
    
    await onSuccess(newVocabList);
    onClose();
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed)) {
        await onSuccess(parsed);
        onClose();
      }
    } catch(e) { alert("Invalid JSON"); }
  };

  const parseCSV = (csvText: string): Partial<VocabItem>[] => {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const clean = (s: string) => s ? s.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : '';
      return {
        word: clean(parts[1]),
        meaning: clean(parts[2]),
        type: clean(parts[3]) || 'noun',
        phonetic: clean(parts[4]),
        tags: clean(parts[5]) ? clean(parts[5]).split(';') : []
      };
    }).filter(v => v.word && v.meaning);
  };

  const convertToCSV = (items: VocabItem[]) => {
    const header = ['STT', 'Word', 'Meaning', 'Type', 'Phonetic', 'Tags'];
    const rows = items.map(v => [
      v.stt,
      `"${v.word.replace(/"/g, '""')}"`,
      `"${v.meaning.replace(/"/g, '""')}"`,
      v.type,
      `"${(v.phonetic || '').replace(/"/g, '""')}"`,
      `"${(v.tags || []).join(';')}"`
    ]);
    return [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex bg-gray-50 border-b border-gray-100">
          <button onClick={() => setDataTab('single')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${dataTab === 'single' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <Plus className="w-4 h-4"/> {editingWord ? 'Edit Word' : 'Add Word'}
          </button>
          <button onClick={() => setDataTab('import')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${dataTab === 'import' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <Upload className="w-4 h-4"/> Import
          </button>
          <button onClick={() => setDataTab('export')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${dataTab === 'export' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <Download className="w-4 h-4"/> Export
          </button>
          <button onClick={onClose} className="p-4 text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6"/></button>
        </div>

        <div className="p-8">
          {dataTab === 'single' && (
            <form onSubmit={handleAddWord} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">English Word</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="e.g. Epiphany" 
                      value={newWord.word} 
                      onChange={e => setNewWord({...newWord, word: e.target.value})} 
                      onBlur={() => !editingWord && newWord.word && fetchWordDetails(newWord.word)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none pr-12" 
                      required 
                    />
                    <button 
                      type="button"
                      onClick={() => fetchWordDetails(newWord.word)}
                      disabled={isFetching || !newWord.word}
                      className="absolute right-2 top-1.5 p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30"
                    >
                      {isFetching ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Lightbulb className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Meaning</label>
                  <input type="text" placeholder="e.g. Sự hiển linh" value={newWord.meaning} onChange={e => setNewWord({...newWord, meaning: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Type</label>
                  <select value={newWord.type} onChange={e => setNewWord({...newWord, type: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="noun">Noun</option><option value="verb">Verb</option><option value="adj">Adjective</option><option value="adv">Adverb</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Phonetic</label>
                  <input disabled type="text" placeholder="/ɪˈpɪf.ə.ni/" value={newWord.phonetic} onChange={e => setNewWord({...newWord, phonetic: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Tags (comma separated)</label>
                <input type="text" placeholder="academic, daily" value={newWord.tags} onChange={e => setNewWord({...newWord, tags: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest text-sm mt-4">
                {editingWord ? 'Update Word' : 'Save Word'}
              </button>
            </form>
          )}

          {dataTab === 'import' && (
            <div className="space-y-6">
              <div className="text-sm text-gray-500 bg-indigo-50 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <p>Paste your <strong>JSON array</strong> or <strong>CSV text</strong> (STT, Word, Meaning, Type, Phonetic, Tags) below. All new words will be merged with your existing library.</p>
              </div>
              <textarea 
                value={jsonInput} onChange={e => setJsonInput(e.target.value)} 
                placeholder="[ { 'word': 'example', ... } ] OR CSV rows..."
                className="w-full h-48 p-4 bg-gray-50 border border-gray-100 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleImportJson} className="py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all">Import as JSON</button>
                <button 
                  onClick={async () => {
                    const parsed = parseCSV(jsonInput);
                    if (parsed.length > 0) {
                      const baseSTT = vocab.length > 0 ? Math.max(...vocab.map(v => v.stt)) + 1 : 1;
                      const newItems = parsed.map((v, i) => ({ ...v, stt: baseSTT + i, archived: false } as VocabItem));
                      const newVocab = [...vocab, ...newItems];
                      await onSuccess(newVocab);
                      alert(`Imported ${newItems.length} words from CSV!`);
                      onClose();
                    } else { alert("Invalid CSV format"); }
                  }} 
                  className="py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Import as CSV
                </button>
              </div>
            </div>
          )}

          {dataTab === 'export' && (
            <div className="space-y-6 text-center">
              <div className="p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <Download className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
                <h4 className="font-bold text-gray-900 mb-1">Download Library Backup</h4>
                <p className="text-sm text-gray-500 mb-6">Choose your preferred format to save your vocabulary.</p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(vocab, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'vocab_backup.json'; a.click();
                    }}
                    className="py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Download JSON
                  </button>
                  <button 
                    onClick={() => {
                      const csv = convertToCSV(vocab);
                      const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'vocab_export.csv'; a.click();
                    }}
                    className="py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
              <div className="text-left">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Raw JSON Data</label>
                <textarea readOnly value={jsonInput} className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl font-mono text-[10px] text-gray-400" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(AddModal);
