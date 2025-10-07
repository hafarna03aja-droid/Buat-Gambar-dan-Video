
import React from 'react';
import { AspectRatio } from '../types';
import { ASPECT_RATIOS } from '../constants';
import Header from '../components/Header';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';

interface ProjectSetupScreenProps {
    onSelectAspectRatio: (aspectRatio: AspectRatio) => void;
    onBack: () => void;
}

const ProjectSetupScreen: React.FC<ProjectSetupScreenProps> = ({ onSelectAspectRatio, onBack }) => {
    return (
        <div className="flex flex-col h-full">
            <Header title="Proyek Baru" showUserIcon={false} onBack={onBack} backIcon={<ArrowLeftIcon className="w-6 h-6"/>} />
            <main className="flex-grow p-6 bg-gray-50">
                <h2 className="text-xl font-semibold text-center text-gray-800 mb-2 font-poppins">Pilih Ukuran Kanvas</h2>
                <p className="text-center text-gray-500 mb-6">Pilih rasio aspek yang telah ditentukan untuk memulai.</p>
                <div className="space-y-3">
                    {ASPECT_RATIOS.map(ar => (
                        <button
                            key={ar.name}
                            onClick={() => onSelectAspectRatio(ar)}
                            className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg text-left hover:border-yellow-400 hover:shadow-md transition-all duration-200"
                        >
                            <div>
                                <h3 className="font-semibold text-gray-800">{ar.name}</h3>
                                <p className="text-sm text-gray-500">{ar.ratio}</p>
                            </div>
                            <div className="w-12 h-12 bg-gray-200 rounded-md" style={{ aspectRatio: ar.ratio.replace(':', '/') }}></div>
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default ProjectSetupScreen;
