import { GoogleGenAI, Modality } from "@google/genai";
import { Composition } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

export const generateCompositions = async (subjectFile: File, backgroundFile: File, userPrompt: string): Promise<Composition[]> => {
    try {
        const imageEditingModel = 'gemini-2.5-flash-image';
        const subjectPart = await fileToGenerativePart(subjectFile);
        const backgroundPart = await fileToGenerativePart(backgroundFile);

        const baseInstruction = `Ini adalah tugas pembuatan iklan. Tujuannya adalah untuk menggabungkan gambar pertama (subjek) ke dalam gambar kedua (latar belakang) secara mulus dan realistis. Pertama, hapus latar belakang dari subjek secara akurat. Kemudian, letakkan ke dalam adegan latar belakang. Anda HARUS menyesuaikan pencahayaan, bayangan, dan gradasi warna agar gambar akhir terlihat benar-benar alami dan diedit secara profesional.`;
        const userInstruction = userPrompt ? `Perhatikan baik-baik permintaan spesifik pengguna: "${userPrompt}".` : '';

        // Buat 3 arahan kreatif yang berbeda untuk AI guna menghasilkan variasi.
        const prompts = [
            {
                prompt: `${baseInstruction} Untuk versi ini, buat komposisi yang standar dan realistis. Tempatkan subjek secara alami di dalam adegan, dengan memperhatikan skala dan perspektif. ${userInstruction}`,
                promptTitle: `Komposisi realistis. ${userPrompt}`
            },
            {
                prompt: `${baseInstruction} Untuk versi ini, buat komposisi yang dinamis dan menarik perhatian. Gunakan close-up subjek di latar depan dengan latar belakang sedikit buram untuk menciptakan kesan kedalaman dan fokus. ${userInstruction}`,
                promptTitle: `Fokus latar depan yang dinamis. ${userPrompt}`
            },
            {
                prompt: `${baseInstruction} Untuk versi ini, buat komposisi artistik atau konseptual. Misalnya, split-screen yang kreatif, pantulan yang menarik, atau menempatkan subjek dengan cara yang tidak biasa namun menarik secara visual. ${userInstruction}`,
                promptTitle: `Interpretasi artistik. ${userPrompt}`
            }
        ];

        const generationPromises = prompts.map(async ({ prompt, promptTitle }) => {
            const response = await ai.models.generateContent({
                model: imageEditingModel,
                contents: {
                    parts: [
                        subjectPart, // Gambar subjek
                        backgroundPart, // Gambar latar belakang
                        { text: prompt }, // Instruksi teks
                    ],
                },
                config: {
                    // Harus menyertakan IMAGE untuk mendapatkan output gambar
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            // Ekstrak gambar dari respons dengan aman
            for (const part of response?.candidates?.[0]?.content?.parts ?? []) {
                if (part.inlineData) {
                    const base64ImageBytes = part.inlineData.data;
                    return {
                        id: `comp-${Date.now()}-${Math.random()}`,
                        imageUrl: `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`,
                        prompt: promptTitle,
                    };
                }
            }
            return null; // Kembalikan null jika tidak ada gambar yang ditemukan
        });

        const results = await Promise.all(generationPromises);
        const compositions = results.filter((c): c is Composition => c !== null);

        if (compositions.length === 0) {
            throw new Error("AI tidak mengembalikan gambar yang valid.");
        }

        return compositions;
    } catch (error) {
        console.error("Error in Gemini Service:", error);
        // Sediakan data fallback jika terjadi kesalahan API
        return [
            { id: 'error-1', imageUrl: 'https://picsum.photos/seed/err1/512/512', prompt: 'Error generating image 1' },
            { id: 'error-2', imageUrl: 'https://picsum.photos/seed/err2/512/512', prompt: 'Error generating image 2' },
            { id: 'error-3', imageUrl: 'https://picsum.photos/seed/err3/512/512', prompt: 'Error generating image 3' },
        ];
    }
};

export const generateVideoFromImage = async (imageBase64: string, mimeType: string, prompt: string) => {
    try {
        const operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: {
                imageBytes: imageBase64,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1,
            }
        });
        return operation;
    } catch (error) {
        console.error("Error initiating video generation:", error);
        throw new Error("Gagal memulai pembuatan video.");
    }
};

export const checkVideoGenerationStatus = async (operation: any) => {
    try {
        const updatedOperation = await ai.operations.getVideosOperation({ operation: operation });
        return updatedOperation;
    } catch (error) {
        console.error("Error checking video generation status:", error);
        throw new Error("Gagal memeriksa status video.");
    }
};