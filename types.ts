export enum Screen {
    Home = 'HOME',
    ProjectSetup = 'PROJECT_SETUP',
    Editor = 'EDITOR',
    CompositionShowcase = 'COMPOSITION_SHOWCASE',
    FineTuning = 'FINE_TUNING',
    Export = 'EXPORT',
}

export interface AspectRatio {
    name: string;
    ratio: string;
    value: number; // width / height
}

export interface Project {
    id: string;
    name: string;
    previewUrl: string;
    aspectRatio?: AspectRatio;
}

export interface ImageFile {
    id: string;
    file: File;
    url: string;
}

export interface Composition {
    id:string;
    imageUrl: string;
    prompt: string;
}

export interface Layer {
    id: string;
    type: 'text' | 'logo';
    x: number;
    y: number;
    rotation: number;
    scale: number;
}

export interface TextLayer extends Layer {
    type: 'text';
    content: string;
    font: string;
    size: number;
    color: string;
    style: {
        bold: boolean;
        italic: boolean;
    };
}

export interface LogoLayer extends Layer {
    type: 'logo';
    url: string;
}

// For saving state to localStorage
export interface SerializableImageFile {
    id: string;
    name: string;
    type: string;
    base64: string;
}

export interface AppState {
    currentScreen: Screen;
    activeProject: Partial<Project>;
    uploadedImages: SerializableImageFile[];
    compositions: Composition[];
    selectedComposition: Composition | null;
    textLayers: TextLayer[];
    logoLayers: LogoLayer[];
    userPrompt?: string;
}