'use client'
import React from 'react';

interface Bookmaker {
    key: string;
    title: string;
}

interface SportsbookSelectorProps {
    bookmakers: Bookmaker[];
    selectedBook: Bookmaker;
    onSelectBook: (book: Bookmaker) => void;
}

const SportsbookSelector: React.FC<SportsbookSelectorProps> = ({ bookmakers, selectedBook, onSelectBook }) => {
    return (
        <div className="mt-4">
            <select
                value={selectedBook.key}
                onChange={(e) => {
                    const book = bookmakers.find(b => b.key === e.target.value);
                    if (book) {
                        onSelectBook(book);
                    }
                }}
                className="w-full bg-gray-800 text-white text-sm rounded-lg p-2 border border-gray-700 focus:ring-blue-500 focus:border-blue-500"
            >
                {bookmakers.map(book => (
                    <option key={book.key} value={book.key}>{book.title}</option>
                ))}
            </select>
        </div>
    );
};

export default SportsbookSelector;
