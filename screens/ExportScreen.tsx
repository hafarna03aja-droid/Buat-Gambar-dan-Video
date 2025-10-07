import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Composition, TextLayer, LogoLayer } from '../types';
import Header from '../components/Header';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import FilmIcon from '../components/icons/FilmIcon';
import { generateVideoFromImage, checkVideoGenerationStatus } from '../services/geminiService';

interface ExportScreenProps {
    composition: Composition;
    textLayers: TextLayer[];
    logoLayers: LogoLayer[];
    onBack: () => void;
}

type VideoGenerationState = 'idle' | 'prompting' | 'generating' | 'done' | 'error';

const LOADING_MESSAGES = [
    "Menghubungi satelit AI...",
    "Membangkitkan mesin VEO...",
    "Merender frame pertama...",
    "Menerapkan sentuhan sinematik...",
    "Menyusun piksel menjadi gerakan...",
    "Hampir selesai, memoles hasilnya...",
];

const ExportScreen: React.FC<ExportScreenProps> = ({
    composition,
    textLayers,
    logoLayers,
    onBack,
}) => {
    const [format, setFormat] = useState<'png' | 'jpeg'>('png');
    const [quality, setQuality] = useState<number>(0.92); // Corresponds to 'High' for JPEG
    const [isDownloading, setIsDownloading] = useState(false);
    const previewRef = React.useRef<HTMLDivElement>(null);
    
    // State for video generation
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [videoPrompt, setVideoPrompt] = useState('');
    const [videoGenerationState, setVideoGenerationState] = useState<VideoGenerationState>('idle');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [videoProgress, setVideoProgress] = useState(0);
    const [isFinalizingDownload, setIsFinalizingDownload] = useState(false);
    const videoOperationRef = useRef<any>(null);

    const renderFinalImageOnCanvas = useCallback(async (canvas: HTMLCanvasElement) => {
        if (!previewRef.current) return;

        const exportResolution = 1080;
        const previewSize = previewRef.current.getBoundingClientRect();
        const aspectRatio = previewSize.width > 0 ? previewSize.height / previewSize.width : 1;

        canvas.width = exportResolution;
        canvas.height = exportResolution * aspectRatio;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Gagal mendapatkan konteks kanvas.');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Load and draw base image
        const baseImage = new Image();
        baseImage.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            baseImage.onload = resolve;
            baseImage.onerror = () => reject(new Error('Gagal memuat gambar dasar.'));
            baseImage.src = composition.imageUrl;
        });
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

        // 2. Load and draw logo layers
        const logoPromises = logoLayers.map(layer => {
            return new Promise<void>((resolve, reject) => {
                const logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';
                logoImg.onload = () => {
                    const x = (layer.x / 100) * canvas.width;
                    const y = (layer.y / 100) * canvas.height;
                    const logoWidth = 60 * (exportResolution / previewSize.width) * layer.scale;
                    const logoHeight = (logoWidth / logoImg.width) * logoImg.height;

                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate((layer.rotation * Math.PI) / 180);
                    ctx.drawImage(logoImg, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
                    ctx.restore();
                    resolve();
                };
                logoImg.onerror = () => reject(new Error(`Gagal memuat logo: ${layer.url}`));
                logoImg.src = layer.url;
            });
        });
        await Promise.all(logoPromises);

        // 3. Draw text layers
        textLayers.forEach(layer => {
            const x = (layer.x / 100) * canvas.width;
            const y = (layer.y / 100) * canvas.height;
            const fontSize = layer.size * (exportResolution / previewSize.width) * layer.scale;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((layer.rotation * Math.PI) / 180);
            
            const fontWeight = layer.style.bold ? 'bold' : 'normal';
            const fontStyle = layer.style.italic ? 'italic' : 'normal';
            ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${layer.font}`;
            ctx.fillStyle = layer.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1 * (exportResolution / previewSize.width);
            ctx.shadowOffsetY = 1 * (exportResolution / previewSize.width);

            ctx.fillText(layer.content, 0, 0);
            ctx.restore();
        });
    }, [composition.imageUrl, textLayers, logoLayers]);

    const handleDownload = useCallback(async () => {
        setIsDownloading(true);
        const canvas = document.createElement('canvas');
        try {
            await renderFinalImageOnCanvas(canvas);
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const dataUrl = canvas.toDataURL(mimeType, format === 'jpeg' ? quality : undefined);
            const link = document.createElement('a');
            link.download = `adfuse-banana-export-${Date.now()}.${format}`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Gagal merender kanvas untuk diunduh:", error);
            alert(`Terjadi kesalahan saat menyiapkan unduhan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsDownloading(false);
        }
    }, [format, quality, renderFinalImageOnCanvas]);

    // Video Generation Handlers
    const handleStartVideoGeneration = () => {
        if (videoGenerationState === 'idle') {
            setVideoGenerationState('prompting');
        }
        setIsModalOpen(true);
    };

    const handleRestartVideoGeneration = () => {
        setVideoGenerationState('prompting');
        setVideoUrl(null);
        setVideoPrompt('');
        setLoadingMessage('');
        setErrorMessage('');
        setVideoProgress(0);
        videoOperationRef.current = null;
        setIsFinalizingDownload(false);
    };

    const handleConfirmVideoGeneration = async () => {
        if (!videoPrompt.trim()) {
            alert('Silakan masukkan deskripsi untuk animasi video.');
            return;
        }

        setVideoGenerationState('generating');
        setVideoProgress(0);
        setLoadingMessage('Mempersiapkan gambar akhir...');

        const canvas = document.createElement('canvas');
        try {
            await renderFinalImageOnCanvas(canvas);
            const mimeType = 'image/jpeg';
            const dataUrl = canvas.toDataURL(mimeType, 0.92);
            const base64 = dataUrl.split(',')[1];
            
            const enhancedPrompt = `Ini adalah tugas pembuatan video iklan profesional. Tujuannya adalah untuk menganimasikan gambar statis yang diberikan.

ATURAN PALING PENTING: JANGAN MENGUBAH GAMBAR ASLI SAMA SEKALI. Subjek, produk, latar belakang, teks, logo, dan komposisi keseluruhan HARUS TETAP IDENTIK dengan gambar sumber. Hasilnya harus berupa video dari gambar yang sama persis, tetapi menjadi hidup, bukan gambar baru.

Tugas Anda adalah menambahkan gerakan halus dan berkualitas sinematik. Fokus pada:
1.  **Kualitas Video:** Hasilkan dalam definisi tinggi (HD 1080p), dengan visual yang tajam, jernih, dan profesional.
2.  **Animasi Halus:** Animasikan elemen yang sudah ada. JANGAN menambahkan elemen baru.
3.  **Permintaan Pengguna:** Terapkan permintaan spesifik berikut: '${videoPrompt}'.

Contoh animasi yang baik: uap yang mengepul perlahan dari kopi, kilauan cahaya yang bergerak di atas permukaan produk, pergerakan kamera yang sangat lambat (zoom in atau pan), atau bayangan yang sedikit bergeser. Hindari gerakan yang cepat atau berlebihan.`;

            const operation = await generateVideoFromImage(base64, mimeType, enhancedPrompt);
            videoOperationRef.current = operation;
        } catch (error) {
            console.error(error);
            setVideoGenerationState('error');
            setErrorMessage("Waduh, gagal memulai pembuatan video. Coba periksa koneksi internet Anda dan coba lagi sesaat lagi.");
        }
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleDownloadAndClose = () => {
        if (!videoUrl || isFinalizingDownload) return;
        
        setIsFinalizingDownload(true);

        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `adfuse-banana-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            handleCloseModal();
            setIsFinalizingDownload(false);
        }, 1000);
    };


    useEffect(() => {
        if (videoGenerationState !== 'generating') return;

        // Message cycler
        let messageIndex = 0;
        const messageInterval = setInterval(() => {
             setLoadingMessage(LOADING_MESSAGES[messageIndex]);
             messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
        }, 3000);

        // Simulated initial progress
        let simulatedProgress = 0;
        const simulationInterval = setInterval(() => {
            if (simulatedProgress < 10) {
                 simulatedProgress += 1;
                 setVideoProgress(p => Math.max(p, simulatedProgress));
            } else {
                clearInterval(simulationInterval);
            }
        }, 500);

        // Real progress polling
        const pollInterval = setInterval(async () => {
            if (!videoOperationRef.current) return;
            try {
                const operation = await checkVideoGenerationStatus(videoOperationRef.current);
                videoOperationRef.current = operation;

                // Use real progress if available and greater than simulated progress
                const realProgress = operation.metadata?.progress?.percentage;
                if (typeof realProgress === 'number') {
                    setVideoProgress(p => Math.max(p, realProgress));
                }
                
                if (operation.done) {
                    clearInterval(pollInterval);
                    clearInterval(simulationInterval);
                    clearInterval(messageInterval);
                    setVideoProgress(100);

                    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (downloadLink) {
                        setLoadingMessage('Video selesai! Mengambil data...');
                         try {
                            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                            if (!response.ok) {
                                throw new Error(`Server merespons dengan status ${response.status}`);
                            }
                            const videoBlob = await response.blob();
                            setVideoUrl(URL.createObjectURL(videoBlob));
                            setVideoGenerationState('done');
                        } catch (fetchError) {
                            console.error("Gagal mengunduh video blob:", fetchError);
                            setVideoGenerationState('error');
                            setErrorMessage("Video berhasil dibuat, tetapi gagal diunduh. Periksa koneksi internet Anda dan coba lagi.");
                        }
                    } else {
                         setVideoGenerationState('error');
                         setErrorMessage("AI telah selesai bekerja, namun tidak ada video yang valid dihasilkan. Coba lagi dengan perintah animasi yang sedikit berbeda.");
                    }
                }
            } catch (error) {
                setVideoGenerationState('error');
                setErrorMessage("Sepertinya ada gangguan saat memeriksa status video. Prosesnya mungkin terhenti. Silakan coba lagi.");
                clearInterval(pollInterval);
                clearInterval(simulationInterval);
                clearInterval(messageInterval);
            }
        }, 5000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(simulationInterval);
            clearInterval(messageInterval);
        };
    }, [videoGenerationState]);

    const renderVideoModal = () => (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={handleCloseModal}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                     <h2 className="text-xl font-bold font-poppins text-gray-800">Animasikan Gambar Anda</h2>
                     <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
                </div>
                
                <div className="p-6 flex-grow overflow-y-auto">
                    {videoGenerationState === 'prompting' && (
                        <div className="space-y-4">
                            <img src={composition.imageUrl} alt="Pratinjau" className="w-full aspect-square object-cover rounded-lg shadow-md" />
                            <div>
                                <label htmlFor="video-prompt" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Animasi</label>
                                <textarea
                                    id="video-prompt"
                                    rows={3}
                                    className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-yellow-400 focus:border-yellow-400 transition"
                                    placeholder="Contoh: buat kopi mengepulkan uap dan croissant berkilau"
                                    value={videoPrompt}
                                    onChange={(e) => setVideoPrompt(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {(videoGenerationState === 'generating' || videoGenerationState === 'error') && (
                         <div className="flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                            {videoGenerationState === 'generating' && (
                                <svg className="animate-spin h-10 w-10 text-yellow-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {videoGenerationState === 'error' && (
                               <svg className="h-12 w-12 text-red-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                               </svg>
                            )}
                             <h3 className="text-lg font-semibold text-gray-800">{videoGenerationState === 'error' ? 'Terjadi Kesalahan' : 'AI Sedang Bekerja...'}</h3>
                             
                             {videoGenerationState === 'generating' && (
                                <div className="w-full max-w-xs mt-4">
                                    <div className="bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-yellow-400 h-2.5 rounded-full transition-all duration-500 ease-linear" style={{ width: `${videoProgress}%` }}></div>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2 font-semibold">{Math.round(videoProgress)}% Selesai</p>
                                </div>
                             )}

                             <p className={`mt-2 text-sm max-w-xs ${videoGenerationState === 'error' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {videoGenerationState === 'error' ? errorMessage : loadingMessage}
                             </p>
                             <p className="text-xs text-gray-400 mt-4">Proses ini dapat memakan waktu beberapa menit. Anda dapat menutup modal ini, namun jangan tutup tab browser.</p>
                             {videoGenerationState === 'error' && (
                                 <button onClick={handleRestartVideoGeneration} className="mt-6 px-5 py-2.5 bg-yellow-400 text-gray-800 font-bold rounded-lg hover:bg-yellow-500 transition-colors">
                                    Coba Lagi
                                 </button>
                             )}
                         </div>
                    )}

                    {videoGenerationState === 'done' && videoUrl && (
                        <div className="space-y-4">
                            <video src={videoUrl} controls autoPlay loop className="w-full aspect-square object-cover rounded-lg shadow-md bg-gray-200" />
                            <button 
                                onClick={handleDownloadAndClose} 
                                disabled={isFinalizingDownload}
                                className="w-full block text-center py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors disabled:bg-green-300 disabled:cursor-wait"
                            >
                                {isFinalizingDownload ? 'Mengunduh...' : 'Unduh & Selesai'}
                            </button>
                            <button onClick={handleRestartVideoGeneration} className="w-full py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors">
                                Buat Animasi Lain
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex gap-3">
                    <button onClick={handleCloseModal} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors">
                        {videoGenerationState === 'generating' ? 'Tutup (Proses Latar Belakang)' : 'Tutup'}
                    </button>
                    {videoGenerationState === 'prompting' && (
                        <button onClick={handleConfirmVideoGeneration} className="flex-1 py-3 bg-yellow-400 text-gray-800 font-bold rounded-lg hover:bg-yellow-500 transition-colors">
                            Hasilkan Video
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const videoButtonText = () => {
        switch (videoGenerationState) {
            case 'generating':
                return `Membuat Video... (${Math.round(videoProgress)}%)`;
            case 'done':
                return 'Lihat Video';
            case 'error':
                return 'Gagal! Coba Lagi';
            default:
                return 'Buat Video Animasi';
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <Header
                title="Ekspor"
                showUserIcon={false}
                onBack={onBack}
                backIcon={<ArrowLeftIcon className="w-6 h-6" />}
            />
            <main className="flex-grow flex flex-col items-center p-4 overflow-y-auto">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 font-poppins flex-shrink-0">Pratinjau Akhir</h2>

                <div ref={previewRef} className="w-full max-w-sm aspect-square bg-black rounded-lg overflow-hidden relative shadow-lg flex-shrink-0">
                    <img src={composition.imageUrl} alt={composition.prompt} className="w-full h-full object-cover" />
                    {textLayers.map(layer => (
                        <div
                            key={layer.id}
                            className="absolute pointer-events-none"
                            style={{
                                top: `${layer.y}%`,
                                left: `${layer.x}%`,
                                transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                                fontFamily: layer.font,
                                fontSize: `${layer.size}px`,
                                color: layer.color,
                                fontWeight: layer.style.bold ? 'bold' : 'normal',
                                fontStyle: layer.style.italic ? 'italic' : 'normal',
                                whiteSpace: 'nowrap',
                                textShadow: '1px 1px 3px rgba(0,0,0,0.5)',
                            }}
                        >
                            {layer.content}
                        </div>
                    ))}
                    {logoLayers.map(layer => (
                        <img
                            key={layer.id}
                            src={layer.url}
                            alt="logo"
                            className="absolute pointer-events-none"
                            style={{
                                top: `${layer.y}%`,
                                left: `${layer.x}%`,
                                transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                                width: '60px',
                            }}
                        />
                    ))}
                </div>

                <div className="w-full max-w-sm mt-6 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">Opsi Ekspor Gambar</h3>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                            <div>
                                <label className="font-semibold text-gray-600">Format</label>
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => setFormat('png')} className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${format === 'png' ? 'bg-yellow-400 text-gray-800' : 'bg-gray-100 hover:bg-gray-200'}`}>PNG</button>
                                    <button onClick={() => setFormat('jpeg')} className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${format === 'jpeg' ? 'bg-yellow-400 text-gray-800' : 'bg-gray-100 hover:bg-gray-200'}`}>JPEG</button>
                                </div>
                            </div>

                            {format === 'jpeg' && (
                                <div>
                                    <label className="font-semibold text-gray-600">Kualitas</label>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => setQuality(0.5)} className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${quality === 0.5 ? 'bg-yellow-400 text-gray-800' : 'bg-gray-100 hover:bg-gray-200'}`}>Rendah</button>
                                        <button onClick={() => setQuality(0.75)} className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${quality === 0.75 ? 'bg-yellow-400 text-gray-800' : 'bg-gray-100 hover:bg-gray-200'}`}>Sedang</button>
                                        <button onClick={() => setQuality(0.92)} className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${quality === 0.92 ? 'bg-yellow-400 text-gray-800' : 'bg-gray-100 hover:bg-gray-200'}`}>Tinggi</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="w-full mt-4 py-3 px-4 bg-yellow-400 text-gray-800 font-bold rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isDownloading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Memproses...
                                </>
                            ) : `Unduh sebagai ${format.toUpperCase()}`}
                        </button>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">Opsi Video</h3>
                         <button
                            onClick={handleStartVideoGeneration}
                            disabled={videoGenerationState === 'generating'}
                            className="w-full py-3 px-4 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center disabled:bg-gray-500 disabled:cursor-wait"
                        >
                            <FilmIcon className="w-5 h-5 mr-2" />
                            {videoButtonText()}
                        </button>
                    </div>
                </div>
            </main>
            {isModalOpen && renderVideoModal()}
        </div>
    );
};

export default ExportScreen;