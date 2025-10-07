import React, { useRef } from 'react';
import { ImageFile, AspectRatio } from '../types';
import Header from '../components/Header';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import PlusIcon from '../components/icons/PlusIcon';

interface EditorScreenProps {
    images: ImageFile[];
    onAddImage: (file: File) => void;
    onRemoveImage: (id: string) => void;
    onFuse: () => void;
    aspectRatio: AspectRatio;
    onBack: () => void;
    onSaveProject: () => void;
    prompt: string;
    onPromptChange: (prompt: string) => void;
}

const ImageTray: React.FC<Pick<EditorScreenProps, 'images' | 'onAddImage' | 'onRemoveImage'>> = ({ images, onAddImage, onRemoveImage }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onAddImage(event.target.files[0]);
        }
    };

    return (
        <div className="bg-white p-3 border-t border-gray-200">
            <div className="flex items-center gap-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition-colors"
                >
                    <PlusIcon className="w-6 h-6 mb-1" />
                    <span className="text-xs font-semibold">Tambah</span>
                </button>
                <div className="flex-grow flex items-center gap-3 overflow-x-auto">
                    {images.map(img => (
                        <div key={img.id} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden group">
                            <img src={img.url} alt="upload thumbnail" className="w-full h-full object-cover" />
                            <button
                                onClick={() => onRemoveImage(img.id)}
                                className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const EditorScreen: React.FC<EditorScreenProps> = ({ images, onAddImage, onRemoveImage, onFuse, aspectRatio, onBack, onSaveProject, prompt, onPromptChange }) => {
    const canFuse = images.length >= 2;

    const headerActions = (
        <button
            onClick={onSaveProject}
            className="px-3 py-1.5 bg-yellow-400 text-gray-800 text-sm font-bold rounded-md hover:bg-yellow-500 transition-colors"
        >
            Simpan
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-200">
            <Header
                title="Editor"
                showUserIcon={false}
                onBack={onBack}
                backIcon={<ArrowLeftIcon className="w-6 h-6"/>}
                actions={headerActions}
            />
            <main className="flex-grow flex flex-col p-4">
                <div className="flex-grow flex items-center justify-center bg-gray-300/50 rounded-lg" style={{ aspectRatio: aspectRatio.value }}>
                    {images.length === 0 ? (
                        <p className="text-gray-500">Tambah gambar untuk memulai</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 p-2 w-full h-full">
                            {images.map(img => (
                                <img key={img.id} src={img.url} className="w-full h-full object-contain" alt="uploaded content" />
                            ))}
                        </div>
                    )}
                </div>
                <div className="mt-4 space-y-4">
                     <div>
                        <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-700 mb-1 px-1">
                            Perintah Tambahan (Opsional)
                        </label>
                        <textarea
                            id="prompt-input"
                            rows={2}
                            className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-yellow-400 focus:border-yellow-400 transition"
                            placeholder="Contoh: buat sepatu bot terlihat seperti sedang mendaki gunung"
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                        />
                    </div>
                    <div>
                        <button
                            onClick={onFuse}
                            disabled={!canFuse}
                            className={`w-full py-4 px-6 rounded-lg text-lg font-bold font-poppins transition-all duration-300 flex items-center justify-center gap-2 ${canFuse ? 'bg-yellow-400 text-gray-800 hover:bg-yellow-500 shadow-lg' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                        >
                            Fuse with Banana!
                        </button>
                        {!canFuse && <p className="text-center text-sm text-gray-500 mt-2">Tambahkan setidaknya 2 gambar untuk melanjutkan</p>}
                    </div>
                </div>
            </main>
            <ImageTray images={images} onAddImage={onAddImage} onRemoveImage={onRemoveImage} />
        </div>
    );
};

export default EditorScreen;