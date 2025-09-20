

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { LoadingIndicator } from './components/LoadingIndicator';
import { BookPreview } from './components/BookPreview';
import { generatePictureBook } from './services/geminiService';
import type { BookPage, StyleOption } from './types';
import { AppStep, PictureBookStyle } from './types';
import { STYLES, STORY_CHAR_LIMIT } from './constants';
import { BookOpenIcon } from './components/icons/BookOpenIcon';
import { PencilIcon } from './components/icons/PencilIcon';
import { ImageIcon } from './components/icons/ImageIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-amber-200">
        <div className="flex items-center mb-4">
            {icon}
            <h2 className="text-xl font-bold text-amber-700 ml-3 font-mplus">{title}</h2>
        </div>
        {children}
    </div>
);

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.Input);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [theme, setTheme] = useState('');
  const [characterImages, setCharacterImages] = useState<File[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<PictureBookStyle>(STYLES[0].id);
  const [bookPages, setBookPages] = useState<BookPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(4);

  const imagePreviews = useMemo(() => characterImages.map(file => URL.createObjectURL(file)), [characterImages]);

  useEffect(() => {
    // Clean up object URLs to avoid memory leaks
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const handleCreateBook = useCallback(async () => {
    if (!title || !theme || characterImages.length === 0) {
      setError('タイトル、おはなしのテーマ、キャラクターの絵をすべて入力してください。');
      return;
    }
    setError(null);
    setStep(AppStep.Loading);
    try {
      const pages = await generatePictureBook(theme, characterImages, selectedStyle, numPages);
      if (pages.length === 0) {
        throw new Error('絵本のページを生成できませんでした。もう一度試してください。');
      }
      setBookPages(pages);
      setStep(AppStep.Preview);
    } catch (err) {
      setError((err as Error).message);
      setStep(AppStep.Input);
    }
  }, [theme, characterImages, selectedStyle, title, numPages]);
  
  const handleRestart = useCallback(() => {
    setTitle('');
    setAuthor('');
    setTheme('');
    setCharacterImages([]);
    setSelectedStyle(STYLES[0].id);
    setBookPages([]);
    setError(null);
    setStep(AppStep.Input);
    setNumPages(4);
  }, []);

  const handleUpdatePageImage = useCallback((pageId: number, newImageUrl: string) => {
    setBookPages(prevPages => prevPages.map(page => 
        page.id === pageId ? { ...page, imageUrl: newImageUrl } : page
    ));
  }, []);

  const handleRemoveImage = (indexToRemove: number) => {
    setCharacterImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
  };


  const renderContent = () => {
    switch (step) {
      case AppStep.Loading:
        return <LoadingIndicator />;
      case AppStep.Preview:
        return <BookPreview 
                    pages={bookPages} 
                    title={title} 
                    author={author} 
                    style={selectedStyle}
                    onRestart={handleRestart}
                    onUpdatePageImage={handleUpdatePageImage}
                />;
      case AppStep.Input:
      default:
        return (
          <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
                <Card title="絵本の情報" icon={<BookOpenIcon className="w-7 h-7 text-amber-500" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500" placeholder="例：ぼくのすごいドラゴン" />
                        </div>
                        <div>
                            <label htmlFor="author" className="block text-sm font-bold text-gray-700 mb-1">さくしゃ</label>
                            <input type="text" id="author" value={author} onChange={e => setAuthor(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500" placeholder="例：はなこ" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label htmlFor="numPages" className="block text-sm font-bold text-gray-700 mb-1">ページ数</label>
                        <select
                            id="numPages"
                            value={numPages}
                            onChange={e => setNumPages(parseInt(e.target.value, 10))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500 bg-white"
                        >
                            {[4, 6, 8, 10, 12, 14, 16, 18, 20].map((num) => (
                                <option key={num} value={num}>
                                    {num}ページ
                                </option>
                            ))}
                        </select>
                    </div>
                </Card>
            </div>
            <div className="space-y-6">
                <Card title="おはなしのテーマ" icon={<PencilIcon className="w-7 h-7 text-amber-500" />}>
                    <p className="text-sm text-gray-600 mb-2">どんなお話にするか、AIに教えてあげましょう！</p>
                    <textarea value={theme} onChange={e => setTheme(e.target.value)} rows={4} maxLength={STORY_CHAR_LIMIT} className="w-full p-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500" placeholder="例：空を飛びたい恐竜の冒険"></textarea>
                    <p className="text-right text-sm text-gray-500">{theme.length} / {STORY_CHAR_LIMIT}</p>
                </Card>
                <Card title="キャラクターの絵" icon={<ImageIcon className="w-7 h-7 text-amber-500" />}>
                    <p className="text-sm text-gray-600 mb-2">お話に登場するキャラクターの絵を1枚以上アップロードしてください。</p>
                    <input 
                      type="file" 
                      multiple
                      accept="image/png, image/jpeg" 
                      onChange={e => {
                          if (e.target.files) {
                            setCharacterImages(prevImages => [...prevImages, ...Array.from(e.target.files!)]);
                          }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
                    {imagePreviews.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {imagePreviews.map((src, index) => (
                            <div key={src} className="aspect-square relative group">
                              <img src={src} className="w-full h-full object-cover rounded-md" alt={`キャラクターのプレビュー ${index + 1}`} />
                              <button
                                onClick={() => handleRemoveImage(index)}
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                aria-label={`画像を削除 ${index + 1}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                    )}
                </Card>
            </div>
            <div>
                 <Card title="絵本のスタイル" icon={<SparklesIcon className="w-7 h-7 text-amber-500" />}>
                    <div className="grid grid-cols-2 gap-4">
                        {STYLES.map((style: StyleOption) => (
                            <button 
                                key={style.id} 
                                onClick={() => setSelectedStyle(style.id)} 
                                className={`p-4 h-24 flex items-center justify-center rounded-lg border-2 text-center font-semibold transition-colors ${
                                    selectedStyle === style.id 
                                    ? 'bg-amber-500 text-white border-amber-500' 
                                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                {style.name}
                            </button>
                        ))}
                    </div>
                 </Card>
            </div>
            <div className="lg:col-span-2 text-center mt-4">
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <button onClick={handleCreateBook} className="px-12 py-4 bg-orange-500 text-white font-bold text-xl rounded-full hover:bg-orange-600 transition-transform transform hover:scale-105 shadow-lg font-mplus">
                    絵本をつくる！
                </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 text-gray-800">
      <Header />
      <main className="py-8">
        {renderContent()}
      </main>
    </div>
  );
}