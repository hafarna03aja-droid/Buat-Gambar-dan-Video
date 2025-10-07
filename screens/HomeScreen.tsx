import React from 'react';
import { Project } from '../types';
import Header from '../components/Header';
import PlusIcon from '../components/icons/PlusIcon';

interface HomeScreenProps {
    projects: Project[];
    onStartNewProject: () => void;
    onLoadProject: () => void;
}

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
    <div className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer">
        <img src={project.previewUrl} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <h3 className="absolute bottom-3 left-3 text-white font-semibold font-poppins">{project.name}</h3>
    </div>
);

const HomeScreen: React.FC<HomeScreenProps> = ({ projects, onStartNewProject, onLoadProject }) => {
    return (
        <div className="flex flex-col h-full">
            <Header title="AdFuse Banana" />
            <main className="flex-grow p-4 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Proyek Terbaru</h2>
                <div className="grid grid-cols-2 gap-4">
                    {projects.map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
                 <button
                    onClick={onLoadProject}
                    className="w-full mt-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                >
                    Muat Proyek Tersimpan
                </button>
            </main>
            <div className="absolute bottom-10 right-1/2 translate-x-[10.5rem] transform">
                <button
                    onClick={onStartNewProject}
                    className="w-16 h-16 bg-yellow-400 text-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-yellow-500 transition-all duration-300 transform hover:scale-110"
                    aria-label="Start new project"
                >
                    <PlusIcon className="w-8 h-8" />
                </button>
            </div>
        </div>
    );
};

export default HomeScreen;