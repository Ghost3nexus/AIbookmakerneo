
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { PictureBookStyle, BookPage } from '../types';

// Fix: Initialize GoogleGenAI client directly with process.env.API_KEY as per the coding guidelines.
// The API key's availability is assumed to be handled externally.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robustly checks if an error is a retryable 503 "model overloaded" error.
 * This version avoids `instanceof Error` to handle custom error objects thrown by the SDK
 * and defensively checks the structure of the error object and its message property.
 * @param error The error object to check, of unknown type.
 * @returns True if the error is a retryable 503 error, false otherwise.
 */
const isRetryableError = (error: unknown): boolean => {
  // Check if error is an object with a string 'message' property
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    const message = (error as { message: string }).message;
    
    // Try to parse the message as JSON, which is the most reliable method
    try {
      const parsed = JSON.parse(message);
      // Use == for a more lenient check (handles "503" vs 503)
      if (parsed?.error?.code == 503) {
        return true;
      }
    } catch {
      // If JSON parsing fails, fall back to a simple but effective string check
      if (message.includes('503') || message.includes('overloaded')) {
        return true;
      }
    }
  }
  return false;
};


const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const generateStory = async (theme: string, numPages: number): Promise<string[]> => {
    const prompt = `あなたは子供向けの絵本作家です。以下のテーマを元に、${numPages}ページの短い絵本の物語を作成してください。\nテーマ： ${theme}`;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            pages: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.STRING,
                                    description: "絵本の1ページ分の文章。",
                                },
                            },
                        },
                        required: ["pages"],
                    },
                },
            });

            const result = JSON.parse(response.text);
            if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
                return result.pages;
            }
            throw new Error("AIが物語を生成できませんでした。");

        } catch (error) {
            if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
                console.warn(`Story generation failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${INITIAL_DELAY_MS * 2 ** attempt}ms...`);
                await sleep(INITIAL_DELAY_MS * 2 ** attempt);
            } else {
                console.error("Error generating story after retries:", error);
                 throw new Error("物語の生成に失敗しました。AIが混み合っている可能性があるため、しばらくしてからもう一度お試しください。");
            }
        }
    }
    throw new Error("物語の生成に失敗しました。AIが応答しませんでした。");
};


export const generatePictureBook = async (
  theme: string,
  characterImage: File,
  style: PictureBookStyle,
  numPages: number
): Promise<BookPage[]> => {
  const storyParts = await generateStory(theme, numPages);
  
  if (storyParts.length === 0) {
    throw new Error("物語の生成に失敗しました。");
  }

  const pages: BookPage[] = [];
  const originalImageBase64 = await fileToBase64(characterImage);
  
  for (let i = 0; i < storyParts.length; i++) {
    const storyPart = storyParts[i];
    
    const prompt = `あなたは絵本作家兼イラストレーターです。提供された子供の絵に描かれているキャラクターを使って、物語に合った絵本の1ページを作成してください。
元の絵のキャラクターの見た目や雰囲気を尊重し、物語の場面に合わせてポーズや表情を変えてください。
絵本のスタイルは「${style}」でお願いします。
このページの物語は以下の通りです: 「${storyPart}」
子供たちが見てわくわくするような、カラフルで魅力的な絵にしてください。
重要：生成する画像には、いかなる文字やテキストも絶対に含めないでください。イラストのみを生成してください。`;

    let pageGenerated = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: originalImageBase64, mimeType: characterImage.type } },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
            
            const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);

            if (imagePart && imagePart.inlineData) {
                pages.push({
                    id: i,
                    text: storyPart,
                    imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
                    originalImageBase64: originalImageBase64,
                    originalImageMimeType: characterImage.type,
                });
                pageGenerated = true;
                break; 
            } else {
                console.warn(`Page ${i + 1} の画像生成に失敗しましたが、リトライします。 (Attempt ${attempt + 1})`);
            }
        } catch (error) {
            if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
                console.warn(`Page ${i + 1} generation failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${INITIAL_DELAY_MS * 2 ** attempt}ms...`);
                await sleep(INITIAL_DELAY_MS * 2 ** attempt);
            } else {
                 console.error(`Error generating page ${i + 1} after retries:`, error);
                 throw new Error(`ページ ${i + 1} の生成中にエラーが発生しました。AIが混み合っている可能性があります。`);
            }
        }
    }
     if (!pageGenerated) {
        throw new Error(`ページ ${i + 1} の生成に複数回失敗しました。`);
    }
  }

  return pages;
};

export const regeneratePageImage = async (
    storyPart: string,
    originalImageBase64: string,
    originalImageMimeType: string,
    style: PictureBookStyle
): Promise<string> => {
    const prompt = `あなたは絵本作家兼イラストレーターです。子供が描いた絵と物語の一部を元に、素晴らしい絵本の1ページを「再生成」してください。
元の絵のキャラクターや雰囲気を尊重しつつ、物語に合わせてプロのイラストレーターのように描き直してください。
絵本のスタイルは「${style}」でお願いします。
このページの物語は以下の通りです: 「${storyPart}」
先ほどとは少し違う、新しいアイデアで描いてみてください。子供たちがもっと驚くような、クリエイティブな絵をお願いします。
重要：生成する画像には、いかなる文字やテキストも絶対に含めないでください。イラストのみを生成してください。`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: originalImageBase64, mimeType: originalImageMimeType } },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
            if (imagePart && imagePart.inlineData) {
                return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            }
            throw new Error('画像の再生成で有効な画像部分が返されませんでした。');
        } catch (error) {
             if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
                console.warn(`Image regeneration failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${INITIAL_DELAY_MS * 2 ** attempt}ms...`);
                await sleep(INITIAL_DELAY_MS * 2 ** attempt);
            } else {
                console.error("Error regenerating image after retries:", error);
                 throw new Error("画像の再生成に失敗しました。AIが混み合っている可能性があるため、しばらくしてからもう一度お試しください。");
            }
        }
    }
    
    throw new Error('画像の再生成に失敗しました。AIが応答しませんでした。');
};
