
import React from 'react';
import { Composition } from '../types';
import Header from '../components/Header';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';

interface CompositionScreenProps {
    isLoading: boolean;
    compositions: Composition[];
    onSelectComposition: (composition: Composition) => void;
    error: string | null;
    onBack: () => void;
}

const LoadingIndicator: React.FC = () => (
    <div className="flex flex-col items-center justify-center text-center h-full">
        {/* Simple banana peel animation simulation */}
        <div className="relative w-24 h-24 mb-4">
            <div className="animate-spin-slow absolute inset-0 border-4 border-yellow-200 border-t-yellow-400 rounded-full"></div>
            <div className="absolute inset-2 text-3xl animate-pulse">🍌</div>
        </div>
        <h3 className="text-xl font-bold font-poppins text-gray-800">Nano Banana Engine™ bekerja...</h3>
        <p className="text-gray-600 mt-2">Menganalisis gambar dan membuat komposisi...</p>
    </div>
);


const CompositionScreen: React.FC<CompositionScreenProps> = ({ isLoading, compositions, onSelectComposition, error, onBack }) => {
    return (
        <div className="flex flex-col h-full bg-gray-50">
            <Header title="Pilih Komposisi" showUserIcon={false} onBack={onBack} backIcon={<ArrowLeftIcon className="w-6 h-6"/>} />
            <main className="flex-grow p-4">
                {isLoading && <LoadingIndicator />}
                {!isLoading && error && (
                    <div className="text-center p-8">
                        <p className="text-red-600 font-semibold">{error}</p>
                        <button onClick={onBack} className="mt-4 px-4 py-2 bg-yellow-400 text-gray-800 rounded-lg">Kembali ke Editor</button>
                    </div>
                )}
                {!isLoading && !error && (
                     <div className="space-y-4">
                        {compositions.map((comp) => (
                            <div key={comp.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                                <img src={comp.imageUrl} alt="AI composition" className="w-full aspect-square object-cover" />
                                <div className="p-3">
                                    <p className="text-xs text-gray-500 italic truncate mb-2">"{comp.prompt}"</p>
                                    <button
                                        onClick={() => onSelectComposition(comp)}
                                        className="w-full py-2 bg-yellow-400 text-gray-800 font-bold rounded-md hover:bg-yellow-500 transition-colors"
                                    >
                                        Pilih & Sempurnakan
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default CompositionScreen;
