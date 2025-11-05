import React, { FC } from 'react';

export const Modal: FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string, size?: 'md' | 'lg', variant?: 'center' | 'right' }> = ({ isOpen, onClose, children, title, size = 'md', variant = 'center' }) => {
    if (!isOpen) return null;
    const sizeClass = size === 'lg' ? 'max-w-lg' : 'max-w-md';
    const isRight = variant === 'right';
    const containerAlign = isRight
        ? 'justify-center items-center md:justify-end md:items-stretch'
        : 'justify-center items-center';
    const rightDesktopPanel = isRight
        ? 'md:h-full md:max-w-none md:w-[520px] md:rounded-none md:rounded-l-lg md:overflow-y-auto'
        : '';
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-70 z-50 flex p-4 ${containerAlign}`} onClick={onClose}>
            <div className={`bg-gray-800 rounded-lg shadow-2xl p-6 w-full ${sizeClass} ${rightDesktopPanel} transform transition-all`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};