import React, { useState, useCallback } from 'react';
import { Screen, AspectRatio, Project, ImageFile, Composition, TextLayer, LogoLayer, AppState, SerializableImageFile } from './types';
import HomeScreen from './screens/HomeScreen';
import ProjectSetupScreen from './screens/ProjectSetupScreen';
import EditorScreen from './screens/EditorScreen';
import CompositionScreen from './screens/CompositionScreen';
import FineTuningScreen from './screens/FineTuningScreen';
import ExportScreen from './screens/ExportScreen';
import { generateCompositions } from './services/geminiService';

const SAVE_KEY = 'adfuse-banana-saved-project';

// Helper function to convert File to a serializable format
const imageFileToSerializable = async (imageFile: ImageFile): Promise<SerializableImageFile> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile.file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    return {
        id: imageFile.id,
        name: imageFile.file.name,
        type: imageFile.file.type,
        base64: base64,
    };
};

// Helper function to convert serializable format back to File
const serializableToImageFile = (serializable: SerializableImageFile): ImageFile => {
    const byteString = atob(serializable.base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: serializable.type });
    const file = new File([blob], serializable.name, { type: serializable.type });
    return {
        id: serializable.id,
        file: file,
        url: URL.createObjectURL(file),
    };
};

// Compresses a base64 image string to reduce its size for localStorage.
const compressImageForStorage = (base64Str: string, maxSize = 1080): Promise<string> => {
    if (!base64Str.startsWith('data:image')) {
        return Promise.resolve(base64Str);
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            // Only resize if the image is larger than the max size
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = Math.round(height * (maxSize / width));
                    width = maxSize;
                } else {
                    width = Math.round(width * (maxSize / height));
                    height = maxSize;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                // If context fails, return original string
                return resolve(base64Str);
            }

            ctx.drawImage(img, 0, 0, width, height);
            // Convert to JPEG for significant file size reduction. 85% quality is a good balance.
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            console.error("Failed to load image for compression, saving original.");
            resolve(base64Str); // Fallback to original if it fails to load
        };
        img.src = base64Str;
    });
};


const App: React.FC = () => {
    const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.Home);
    const [projects, setProjects] = useState<Project[]>([
        { id: '1', name: 'Cafe Daily Promo', previewUrl: 'https://picsum.photos/seed/proj1/400/400' },
        { id: '2', name: 'Summer Sale Banner', previewUrl: 'https://picsum.photos/seed/proj2/400/400' },
        { id: '3', name: 'New Arrival Ad', previewUrl: 'https://picsum.photos/seed/proj3/400/400' },
    ]);
    const [activeProject, setActiveProject] = useState<Partial<Project>>({});
    const [uploadedImages, setUploadedImages] = useState<ImageFile[]>([]);
    const [compositions, setCompositions] = useState<Composition[]>([]);
    const [selectedComposition, setSelectedComposition] = useState<Composition | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
    const [logoLayers, setLogoLayers] = useState<LogoLayer[]>([]);
    const [userPrompt, setUserPrompt] = useState('');

    const startNewProject = () => {
        setActiveProject({});
        setUploadedImages([]);
        setCompositions([]);
        setSelectedComposition(null);
        setTextLayers([]);
        setLogoLayers([]);
        setUserPrompt('');
        setCurrentScreen(Screen.ProjectSetup);
    };

    const selectAspectRatio = (aspectRatio: AspectRatio) => {
        setActiveProject(prev => ({ ...prev, aspectRatio }));
        setCurrentScreen(Screen.Editor);
    };

    const addImage = (file: File) => {
        const newImage: ImageFile = {
            id: Date.now().toString(),
            file,
            url: URL.createObjectURL(file),
        };
        setUploadedImages(prev => [...prev, newImage]);
    };

    const removeImage = (id: string) => {
        setUploadedImages(prev => prev.filter(img => img.id !== id));
    };

    const handleFuse = useCallback(async () => {
        if (uploadedImages.length < 2) return;
        setIsLoading(true);
        setError(null);
        setCurrentScreen(Screen.CompositionShowcase);
        try {
            const results = await generateCompositions(uploadedImages[0].file, uploadedImages[1].file, userPrompt);
            setCompositions(results);
        } catch (err) {
            console.error(err);
            setError('Gagal membuat komposisi. Silakan coba lagi.');
            // Go back to editor on error
            setCurrentScreen(Screen.Editor);
        } finally {
            setIsLoading(false);
        }
    }, [uploadedImages, userPrompt]);

    const selectCompositionForTuning = (composition: Composition) => {
        setSelectedComposition(composition);
        setCurrentScreen(Screen.FineTuning);
    };
    
    const goToExport = () => {
        setCurrentScreen(Screen.Export);
    }

    const goHome = () => {
        setCurrentScreen(Screen.Home);
    };

    const saveState = useCallback(async () => {
        try {
            // 1. Compress uploadedImages
            const serializableImages = await Promise.all(
                uploadedImages.map(async (imageFile) => {
                    const serializable = await imageFileToSerializable(imageFile);
                    serializable.base64 = await compressImageForStorage(serializable.base64);
                    return serializable;
                })
            );
            
            // 2. Compress compositions
            const compressedCompositions = await Promise.all(
                compositions.map(async (comp) => ({
                    ...comp,
                    imageUrl: await compressImageForStorage(comp.imageUrl),
                }))
            );

            // 3. Compress selectedComposition
            const compressedSelectedComposition = selectedComposition
                ? {
                      ...selectedComposition,
                      imageUrl: await compressImageForStorage(selectedComposition.imageUrl),
                  }
                : null;

            // 4. Compress logoLayers
            const compressedLogoLayers = await Promise.all(
                logoLayers.map(async (logo) => ({
                    ...logo,
                    url: await compressImageForStorage(logo.url),
                }))
            );

            const stateToSave: AppState = {
                currentScreen,
                activeProject,
                uploadedImages: serializableImages,
                compositions: compressedCompositions,
                selectedComposition: compressedSelectedComposition,
                textLayers,
                logoLayers: compressedLogoLayers,
                userPrompt,
            };

            localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
            alert('Proyek berhasil disimpan!');
        } catch (err) {
            console.error("Failed to save project", err);
            if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
                 alert('Gagal menyimpan proyek: Ukuran proyek terlalu besar. Coba gunakan gambar dengan resolusi lebih rendah.');
            } else {
                 alert('Gagal menyimpan proyek.');
            }
        }
    }, [currentScreen, activeProject, uploadedImages, compositions, selectedComposition, textLayers, logoLayers, userPrompt]);

    const loadState = () => {
        const savedStateJSON = localStorage.getItem(SAVE_KEY);
        if (savedStateJSON) {
            try {
                const savedState: AppState = JSON.parse(savedStateJSON);
                const loadedImages = savedState.uploadedImages.map(serializableToImageFile);

                setCurrentScreen(savedState.currentScreen);
                setActiveProject(savedState.activeProject);
                setUploadedImages(loadedImages);
                setCompositions(savedState.compositions);
                setSelectedComposition(savedState.selectedComposition);
                setTextLayers(savedState.textLayers);
                setLogoLayers(savedState.logoLayers);
                setUserPrompt(savedState.userPrompt || '');
                alert('Proyek berhasil dimuat!');
            } catch (err) {
                console.error("Failed to load project", err);
                alert('Gagal memuat proyek. Data mungkin rusak.');
                localStorage.removeItem(SAVE_KEY);
            }
        } else {
            alert('Tidak ada proyek yang tersimpan.');
        }
    };


    const renderScreen = () => {
        switch (currentScreen) {
            case Screen.Home:
                return <HomeScreen projects={projects} onStartNewProject={startNewProject} onLoadProject={loadState} />;
            case Screen.ProjectSetup:
                return <ProjectSetupScreen onSelectAspectRatio={selectAspectRatio} onBack={goHome} />;
            case Screen.Editor:
                return <EditorScreen
                    images={uploadedImages}
                    onAddImage={addImage}
                    onRemoveImage={removeImage}
                    onFuse={handleFuse}
                    aspectRatio={activeProject.aspectRatio ?? { name: 'Square', ratio: '1:1', value: 1 }}
                    onBack={goHome}
                    onSaveProject={saveState}
                    prompt={userPrompt}
                    onPromptChange={setUserPrompt}
                />;
            case Screen.CompositionShowcase:
                return <CompositionScreen
                    isLoading={isLoading}
                    compositions={compositions}
                    onSelectComposition={selectCompositionForTuning}
                    error={error}
                    onBack={() => setCurrentScreen(Screen.Editor)}
                />;
            case Screen.FineTuning:
                if (!selectedComposition) {
                    setCurrentScreen(Screen.Editor);
                    return null;
                }
                return <FineTuningScreen
                    composition={selectedComposition}
                    onBack={() => setCurrentScreen(Screen.CompositionShowcase)}
                    textLayers={textLayers}
                    setTextLayers={setTextLayers}
                    logoLayers={logoLayers}
                    setLogoLayers={setLogoLayers}
                    onSaveProject={saveState}
                    onExport={goToExport}
                />;
            case Screen.Export:
                 if (!selectedComposition) {
                    setCurrentScreen(Screen.Editor);
                    return null;
                }
                return <ExportScreen
                    composition={selectedComposition}
                    textLayers={textLayers}
                    logoLayers={logoLayers}
                    onBack={() => setCurrentScreen(Screen.FineTuning)}
                />;
            default:
                return <HomeScreen projects={projects} onStartNewProject={startNewProject} onLoadProject={loadState} />;
        }
    };

    return (
        <div className="flex justify-center items-start min-h-screen bg-gray-100 p-4 font-sans">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl overflow-hidden" style={{ minHeight: '80vh' }}>
                {renderScreen()}
            </div>
        </div>
    );
};

export default App;