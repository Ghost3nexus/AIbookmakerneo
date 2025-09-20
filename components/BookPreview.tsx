
import React, { useState, useCallback } from 'react';
import type { BookPage, PictureBookStyle } from '../types';
import { regeneratePageImage } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const handleRegenerate = useCallback(async (pageId: number) => {
    setRegeneratingPageId(pageId);
    try {
      const pageToRegen = pages.find(p => p.id === pageId);
      if (pageToRegen) {
        const newImageUrl = await regeneratePageImage(pageToRegen.text, pageToRegen.originalImages, style);
        onUpdatePageImage(pageId, newImageUrl);
      }
    } catch (error) {
      console.error(error);
      alert('画像の再生成に失敗しました。');
    } finally {
      setRegeneratingPageId(null);
    }
  }, [pages, style, onUpdatePageImage]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const captureContainer = document.createElement('div');
      Object.assign(captureContainer.style, {
        position: 'absolute',
        left: '-9999px',
        top: '0',
        width: '595px',
        height: '842px',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Noto Sans JP", sans-serif',
        boxSizing: 'border-box',
        padding: '40px',
      });
      document.body.appendChild(captureContainer);

      // Title Page
      captureContainer.innerHTML = `
        <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; font-family: 'Mochiy Pop One', sans-serif;">
          <h1 style="font-size: 42px; color: #78350f; margin: 0; word-break: break-word;">${title}</h1>
          ${author ? `<p style="font-size: 22px; color: #4b5563; margin-top: 24px;">さく：${author}</p>` : ''}
        </div>`;
      const titleCanvas = await html2canvas(captureContainer, { scale: 2 });
      pdf.addImage(titleCanvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, pdfWidth, pdfHeight);

      // Story Pages
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        pdf.addPage();
        captureContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; width: 100%; height: 100%; justify-content: space-between;">
            <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 20px;">
              <img src="${page.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
            </div>
            <div style="font-size: 14pt; color: #374151; line-height: 1.6; max-height: 30%; overflow-y: auto;">
              <p style="white-space: pre-wrap;">${page.text}</p>
            </div>
            <div style="text-align: center; font-size: 10pt; color: #6b7280; padding-top: 15px;">
              <p>${i + 1}</p>
            </div>
          </div>`;
        const pageCanvas = await html2canvas(captureContainer, { scale: 2 });
        pdf.addImage(pageCanvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      document.body.removeChild(captureContainer);
      pdf.save(`${title.replace(/ /g, '_') || 'AI絵本'}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert('PDFの生成に失敗しました。');
    } finally {
      setIsDownloading(false);
    }
  }, [pages, title, author]);

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

      <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-4">
        <button
          onClick={onRestart}
          className="px-8 py-3 bg-amber-500 text-white font-bold rounded-full hover:bg-amber-600 transition-transform transform hover:scale-105 shadow-lg text-lg w-full sm:w-auto"
        >
          もう一度つくる
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center justify-center px-8 py-3 bg-orange-500 text-white font-bold rounded-full hover:bg-orange-600 transition-transform transform hover:scale-105 shadow-lg text-lg disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          <DownloadIcon className="w-5 h-5 mr-2" />
          {isDownloading ? '作成中...' : '絵本をダウンロード'}
        </button>
      </div>
    </div>
  );
};