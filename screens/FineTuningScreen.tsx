import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Composition, TextLayer, LogoLayer } from '../types';
import Header from '../components/Header';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import { FONT_PAIRINGS } from '../constants';

interface FineTuningScreenProps {
    composition: Composition;
    onBack: () => void;
    textLayers: TextLayer[];
    setTextLayers: React.Dispatch<React.SetStateAction<TextLayer[]>>;
    logoLayers: LogoLayer[];
    setLogoLayers: React.Dispatch<React.SetStateAction<LogoLayer[]>>;
    onSaveProject: () => void;
    onExport: () => void;
}

const FineTuningScreen: React.FC<FineTuningScreenProps> = ({
    composition,
    onBack,
    textLayers,
    setTextLayers,
    logoLayers,
    setLogoLayers,
    onSaveProject,
    onExport,
}) => {
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null); // Parent container for overflow
    const canvasRef = useRef<HTMLDivElement>(null); // The actual transformed canvas

    const [canvasZoom, setCanvasZoom] = useState(1);
    const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });

    const dragInfo = useRef<{
        layerId?: string;
        type: 'move' | 'resize' | 'pan';
        startX: number;
        startY: number;
        // For moving
        initialX?: number;
        initialY?: number;
        // For resizing
        initialScale?: number;
        initialDist?: number;
        centerX?: number;
        centerY?: number;
        // For panning
        initialPanX?: number;
        initialPanY?: number;
    } | null>(null);

    const addTextLayer = () => {
        const newLayer: TextLayer = {
            id: `text-${Date.now()}`,
            type: 'text',
            content: 'Teks Contoh',
            font: 'Poppins',
            size: 24,
            color: '#FFFFFF',
            x: 50,
            y: 50,
            rotation: 0,
            scale: 1,
            style: { bold: false, italic: false },
        };
        setTextLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
    };

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const newLayer: LogoLayer = {
                    id: `logo-${Date.now()}`,
                    type: 'logo',
                    url: reader.result as string,
                    x: 50,
                    y: 75,
                    rotation: 0,
                    scale: 1,
                };
                setLogoLayers(prev => [...prev, newLayer]);
                setSelectedLayerId(newLayer.id);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const addLogoLayer = () => {
        logoInputRef.current?.click();
    };

    const updateLayer = useCallback((id: string, updates: Partial<TextLayer | LogoLayer>) => {
         setTextLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } as TextLayer : l));
         setLogoLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } as LogoLayer : l));
    }, [setTextLayers, setLogoLayers]);
    
    const deleteLayer = (id: string) => {
        setTextLayers(prev => prev.filter(l => l.id !== id));
        setLogoLayers(prev => prev.filter(l => l.id !== id));
        setSelectedLayerId(null);
    }

    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!dragInfo.current) return;
        e.preventDefault();
        
        const touch = 'touches' in e ? e.touches[0] : e;
        
        if (dragInfo.current.type === 'pan') {
            const dx = touch.clientX - dragInfo.current.startX;
            const dy = touch.clientY - dragInfo.current.startY;
            setCanvasPan({
                x: dragInfo.current.initialPanX! + dx,
                y: dragInfo.current.initialPanY! + dy,
            });
        } else if (dragInfo.current.type === 'move') {
            if (!canvasRef.current || !dragInfo.current.layerId) return;
            const { width: parentWidth, height: parentHeight } = canvasRef.current.getBoundingClientRect();
            
            const dx = (touch.clientX - dragInfo.current.startX) / canvasZoom;
            const dy = (touch.clientY - dragInfo.current.startY) / canvasZoom;
            
            const newX = dragInfo.current.initialX! + (dx / (parentWidth / canvasZoom)) * 100;
            const newY = dragInfo.current.initialY! + (dy / (parentHeight / canvasZoom)) * 100;

            updateLayer(dragInfo.current.layerId, { x: newX, y: newY });

        } else if (dragInfo.current.type === 'resize') {
            if (!dragInfo.current.layerId) return;
            const { centerX, centerY, initialDist, initialScale } = dragInfo.current;
            const currentDist = Math.sqrt(Math.pow(touch.clientX - centerX!, 2) + Math.pow(touch.clientY - centerY!, 2));
            
            if (initialDist === 0) return;

            const newScale = initialScale! * (currentDist / initialDist!);
            updateLayer(dragInfo.current.layerId, { scale: Math.max(0.1, newScale) });
        }
    }, [updateLayer, canvasZoom]);

    const handleInteractionEnd = useCallback(() => {
        document.body.style.cursor = 'default';
        dragInfo.current = null;
        window.removeEventListener('mousemove', handleInteractionMove);
        window.removeEventListener('touchmove', handleInteractionMove);
        window.removeEventListener('mouseup', handleInteractionEnd);
        window.removeEventListener('touchend', handleInteractionEnd);
    }, [handleInteractionMove]);

    const handleLayerInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent, layer: TextLayer | LogoLayer, type: 'move' | 'resize') => {
        e.stopPropagation();
        e.preventDefault();
        if (!canvasRef.current) return;
        
        setSelectedLayerId(layer.id);
        const touch = 'touches' in e ? e.touches[0] : e;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        
        const commonDragInfo = {
            layerId: layer.id,
            type,
            startX: touch.clientX,
            startY: touch.clientY,
        };

        if (type === 'move') {
            document.body.style.cursor = 'grabbing';
            dragInfo.current = {
                ...commonDragInfo,
                initialX: layer.x,
                initialY: layer.y,
            };
        } else { // type === 'resize'
            document.body.style.cursor = 'se-resize';
            const layerElement = e.currentTarget.parentElement;
            if (!layerElement) return;

            const layerRect = layerElement.getBoundingClientRect();
            const centerX = layerRect.left + layerRect.width / 2;
            const centerY = layerRect.top + layerRect.height / 2;
            
            const initialDist = Math.sqrt(Math.pow(touch.clientX - centerX, 2) + Math.pow(touch.clientY - centerY, 2));
            
            dragInfo.current = {
                ...commonDragInfo,
                initialScale: layer.scale,
                centerX,
                centerY,
                initialDist,
            };
        }

        window.addEventListener('mousemove', handleInteractionMove);
        window.addEventListener('touchmove', handleInteractionMove);
        window.addEventListener('mouseup', handleInteractionEnd);
        window.addEventListener('touchend', handleInteractionEnd);
    }, [handleInteractionMove, handleInteractionEnd]);

    const handlePanStart = useCallback((e: React.MouseEvent) => {
        // Only pan if clicking on the canvas background itself
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        document.body.style.cursor = 'grabbing';

        dragInfo.current = {
            type: 'pan',
            startX: e.clientX,
            startY: e.clientY,
            initialPanX: canvasPan.x,
            initialPanY: canvasPan.y,
        };

        window.addEventListener('mousemove', handleInteractionMove);
        window.addEventListener('mouseup', handleInteractionEnd);
    }, [canvasPan, handleInteractionMove, handleInteractionEnd]);

    const handleZoomIn = () => setCanvasZoom(z => Math.min(3, z * 1.2));
    const handleZoomOut = () => setCanvasZoom(z => Math.max(0.25, z / 1.2));
    const handleResetZoom = () => {
        setCanvasZoom(1);
        setCanvasPan({ x: 0, y: 0 });
    };


    const selectedLayer =
        textLayers.find(l => l.id === selectedLayerId) ||
        logoLayers.find(l => l.id === selectedLayerId);

    const renderEditorPanel = () => {
        if (!selectedLayer) {
            return (
                <div className="p-4 text-center text-gray-500">
                    Pilih sebuah layer untuk diedit atau tambahkan layer baru.
                </div>
            );
        }

        const isTextLayer = selectedLayer.type === 'text';

        return (
            <div className="p-4 space-y-4">
                <h3 className="font-bold text-lg">Edit Layer</h3>
                {isTextLayer && (
                    <>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Teks</label>
                            <textarea
                                value={(selectedLayer as TextLayer).content}
                                onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })}
                                className="w-full p-2 border rounded-md bg-gray-50"
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                <label className="text-sm font-medium">Gaya Teks</label>
                                <div className="flex gap-1">
                                <button
                                    onClick={() => updateLayer(selectedLayer.id, { style: { ... (selectedLayer as TextLayer).style, bold: !(selectedLayer as TextLayer).style.bold }})}
                                    className={`flex-1 py-1 border rounded-md ${ (selectedLayer as TextLayer).style.bold ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
                                ><b>B</b></button>
                                <button
                                     onClick={() => updateLayer(selectedLayer.id, { style: { ... (selectedLayer as TextLayer).style, italic: !(selectedLayer as TextLayer).style.italic }})}
                                    className={`flex-1 py-1 border rounded-md ${ (selectedLayer as TextLayer).style.italic ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
                                ><i>I</i></button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Warna</label>
                                <input
                                    type="color"
                                    value={(selectedLayer as TextLayer).color}
                                    onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                                    className="w-full p-1 h-10 border rounded-md"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Font</label>
                            <select
                                value={(selectedLayer as TextLayer).font}
                                onChange={e => updateLayer(selectedLayer.id, { font: e.target.value })}
                                className="w-full p-2 border rounded-md bg-gray-50"
                            >
                                {FONT_PAIRINGS.map(fp => (
                                    <option key={fp.heading} value={fp.heading}>{fp.heading}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}
                
                <div className="space-y-1">
                    <label className="text-sm font-medium">Rotasi (°)</label>
                    <input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={e => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })} className="w-full" />
                </div>
                <button onClick={() => deleteLayer(selectedLayer.id)} className="w-full py-2 bg-red-500 text-white font-bold rounded-md hover:bg-red-600">
                    Hapus Layer
                </button>
            </div>
        );
    };

    const headerActions = (
        <div className="flex items-center gap-2">
            <button
                onClick={onSaveProject}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-md hover:bg-gray-100 transition-colors"
            >
                Simpan
            </button>
            <button
                onClick={onExport}
                className="px-3 py-1.5 bg-yellow-400 text-gray-800 text-sm font-bold rounded-md hover:bg-yellow-500 transition-colors"
            >
                Ekspor
            </button>
        </div>
    );
    
    const renderLayer = (layer: TextLayer | LogoLayer) => {
        const isSelected = selectedLayerId === layer.id;
        const textLayer = layer as TextLayer;
        const logoLayer = layer as LogoLayer;

        return (
             <div
                key={layer.id}
                onMouseDown={(e) => handleLayerInteractionStart(e, layer, 'move')}
                onTouchStart={(e) => handleLayerInteractionStart(e, layer, 'move')}
                className={`absolute cursor-grab active:cursor-grabbing ${isSelected ? 'outline-2 outline-dashed outline-yellow-400' : ''}`}
                style={{
                    top: `${layer.y}%`,
                    left: `${layer.x}%`,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
            >
                {layer.type === 'text' && (
                    <span
                        style={{
                            fontFamily: textLayer.font,
                            fontSize: `${textLayer.size}px`,
                            color: textLayer.color,
                            fontWeight: textLayer.style.bold ? 'bold' : 'normal',
                            fontStyle: textLayer.style.italic ? 'italic' : 'normal',
                            whiteSpace: 'nowrap',
                            textShadow: '1px 1px 3px rgba(0,0,0,0.5)',
                        }}
                    >
                        {textLayer.content}
                    </span>
                )}
                {layer.type === 'logo' && (
                     <img
                        src={logoLayer.url}
                        alt="logo"
                        className="pointer-events-none"
                        style={{ width: '60px' }}
                    />
                )}
                {isSelected && (
                    <div
                        className="absolute -bottom-2 -right-2 w-5 h-5 bg-yellow-400 border-2 border-white rounded-full cursor-se-resize z-10"
                        onMouseDown={(e) => handleLayerInteractionStart(e, layer, 'resize')}
                        onTouchStart={(e) => handleLayerInteractionStart(e, layer, 'resize')}
                    />
                )}
            </div>
        )
    };

    return (
        <div className="flex flex-col h-full bg-gray-100">
             <Header
                title="Sempurnakan"
                showUserIcon={false}
                onBack={onBack}
                backIcon={<ArrowLeftIcon className="w-6 h-6"/>}
                actions={headerActions}
            />
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Canvas Area */}
                <main ref={canvasContainerRef} className="p-4 flex-shrink-0 bg-gray-200 overflow-hidden relative cursor-grab active:cursor-grabbing" onMouseDown={handlePanStart}>
                     <div ref={canvasRef} className="w-full aspect-square bg-black rounded-lg overflow-hidden relative shadow-lg origin-center" 
                        style={{
                            transform: `scale(${canvasZoom}) translate(${canvasPan.x}px, ${canvasPan.y}px)`,
                            transition: dragInfo.current ? 'none' : 'transform 0.1s ease-out'
                        }}
                     >
                        <img src={composition.imageUrl} alt={composition.prompt} className="w-full h-full object-cover pointer-events-none" />
                        {textLayers.map(renderLayer)}
                        {logoLayers.map(renderLayer)}
                    </div>
                     {/* Zoom Controls */}
                    <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-md">
                        <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 font-bold text-lg">-</button>
                        <button onClick={handleResetZoom} className="w-14 h-8 text-center text-sm font-semibold rounded hover:bg-gray-200">{Math.round(canvasZoom * 100)}%</button>
                        <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 font-bold text-lg">+</button>
                    </div>
                </main>

                {/* Controls Area */}
                <div className="flex-grow bg-white border-t border-gray-200 overflow-y-auto">
                    <div className="p-4 border-b">
                         <h3 className="font-bold text-lg mb-2">Tambah Layer</h3>
                         <div className="grid grid-cols-2 gap-2">
                             <button onClick={addTextLayer} className="w-full py-2 bg-gray-200 rounded-md hover:bg-gray-300">Tambah Teks</button>
                             <button onClick={addLogoLayer} className="w-full py-2 bg-gray-200 rounded-md hover:bg-gray-300">Tambah Logo</button>
                             <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/png, image/jpeg, image/svg+xml" />
                         </div>
                    </div>
                    {renderEditorPanel()}
                </div>
            </div>
        </div>
    );
};

export default FineTuningScreen;
