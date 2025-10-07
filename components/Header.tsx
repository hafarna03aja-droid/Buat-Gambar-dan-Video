import React from 'react';
import BananaIcon from './icons/BananaIcon';
import UserIcon from './icons/UserIcon';

interface HeaderProps {
    title: string;
    showUserIcon?: boolean;
    onBack?: () => void;
    backIcon?: React.ReactNode;
    actions?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, showUserIcon = true, onBack, backIcon, actions }) => {
    return (
        <header className="p-4 bg-white flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
                 {onBack && (
                    <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
                       {backIcon}
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <BananaIcon className="w-6 h-6 text-yellow-400" />
                    <h1 className="text-xl font-bold font-poppins text-gray-800">{title}</h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {actions}
                {showUserIcon && (
                    <button className="p-2 rounded-full hover:bg-gray-100">
                        <UserIcon className="w-6 h-6 text-gray-600" />
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;