
import React from 'react';
import { BookOpenIcon } from './icons/BookOpenIcon';

export const Header: React.FC = () => {
  return (
    <header className="bg-amber-100 shadow-md p-4">
      <div className="container mx-auto flex items-center justify-center">
        <BookOpenIcon className="w-10 h-10 text-amber-600 mr-3" />
        <h1 className="text-3xl text-amber-800 font-mplus">AI絵本メーカー</h1>
      </div>
    </header>
  );
};
