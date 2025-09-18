
import React, { useState, useCallback } from 'react';
import type { BookPage, PictureBookStyle } from '../types';
import { regeneratePageImage } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';

interface BookPreviewProps {
  pages: BookPage[];
  title: string;
  author: string;
  style: PictureBookStyle;
  onRestart: () => void;
  onUpdatePageImage: (pageId: number, newImageUrl: string) => void;
}

const Page: React.FC<{ page: BookPage, pageNumber: number, onRegenerate: (pageId: number) => void, isRegenerating: boolean }> = ({ page, pageNumber, onRegenerate, isRegenerating }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="aspect-[4/3] relative bg-gray-100">
        <img src={page.imageUrl} alt={`Page ${pageNumber}`} className="w-full h-full object-contain" />
        {isRegenerating && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <SparklesIcon className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <p className="text-gray-700 flex-grow">{page.text}</p>
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm font-bold text-gray-500">{pageNumber}</span>
          <button
            onClick={() => onRegenerate(page.id)}
            disabled={isRegenerating}
            className="flex items-center px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <SparklesIcon className="w-4 h-4 mr-1" />
            画像を再生成
          </button>
        </div>
      </div>
    </div>
  );
};

export const BookPreview: React.FC<BookPreviewProps> = ({ pages, title, author, style, onRestart, onUpdatePageImage }) => {
  const [regeneratingPageId, setRegeneratingPageId] = useState<number | null>(null);

  const handleRegenerate = useCallback(async (pageId: number) => {
    setRegeneratingPageId(pageId);
    try {
      const pageToRegen = pages.find(p => p.id === pageId);
      if (pageToRegen) {
        const newImageUrl = await regeneratePageImage(pageToRegen.text, pageToRegen.originalImageBase64, pageToRegen.originalImageMimeType, style);
        onUpdatePageImage(pageId, newImageUrl);
      }
    } catch (error) {
      console.error(error);
      alert('画像の再生成に失敗しました。');
    } finally {
      setRegeneratingPageId(null);
    }
  }, [pages, style, onUpdatePageImage]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-amber-800 font-mplus">{title}</h1>
        {author && <p className="text-lg text-gray-600 mt-2">さく：{author}</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pages.map((page, index) => (
          <Page 
            key={page.id} 
            page={page} 
            pageNumber={index + 1} 
            onRegenerate={handleRegenerate}
            isRegenerating={regeneratingPageId === page.id}
          />
        ))}
      </div>

      <div className="mt-12 text-center">
        <button
          onClick={onRestart}
          className="px-8 py-3 bg-amber-500 text-white font-bold rounded-full hover:bg-amber-600 transition-transform transform hover:scale-105 shadow-lg text-lg"
        >
          もう一度つくる
        </button>
      </div>
    </div>
  );
};
