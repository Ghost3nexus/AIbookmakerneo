
import React, { useState, useEffect } from 'react';
import { LOADING_MESSAGES } from '../constants';
import { SparklesIcon } from './icons/SparklesIcon';

export const LoadingIndicator: React.FC = () => {
  const [message, setMessage] = useState(LOADING_MESSAGES[0]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessage(prevMessage => {
        const currentIndex = LOADING_MESSAGES.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
        return LOADING_MESSAGES[nextIndex];
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-amber-200">
      <SparklesIcon className="w-16 h-16 text-amber-500 animate-pulse" />
      <h2 className="text-2xl font-bold text-amber-700 mt-4 font-mplus">絵本を作成中...</h2>
      <p className="text-amber-600 mt-2 text-center">{message}</p>
      <div className="w-full bg-amber-200 rounded-full h-2.5 mt-6">
        <div className="bg-amber-500 h-2.5 rounded-full animate-pulse" style={{ width: '75%' }}></div>
      </div>
      <p className="text-sm text-gray-500 mt-4">すてきな絵本ができるまで、もう少しだけ待っててね！</p>
    </div>
  );
};
