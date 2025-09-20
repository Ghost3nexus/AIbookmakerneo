
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { PictureBookStyle, BookPage, OriginalImage } from '../types';

let ai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI instance.
 * This prevents the app from crashing on load if the API key is not yet available.
 * An error is thrown only when an API call is actually made.
 */
const getAiInstance = (): GoogleGenAI => {
    if (ai) {
        return ai;
    }
    // The API key MUST be obtained exclusively from the environment variable `process.env.API_KEY`.
    // Vite configuration (`vite.config.ts`) is set up to replace `process.env.API_KEY` with the actual value at build time.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        // This error will be caught by the calling function and displayed to the user in the UI.
        throw new Error("APIキーが設定されていません。環境変数にAPI_KEYを設定してください。");
    }
    ai = new GoogleGenAI({ apiKey });
    return ai;
};


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


const filesToOriginalImages = (files: File[]): Promise<OriginalImage[]> => {
    const promises = files.map(file => {
        return new Promise<OriginalImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                base64: (reader.result as string).split(',')[1],
                mimeType: file.type
            });
            reader.onerror = error => reject(error);
        });
    });
    return Promise.all(promises);
};

const generateStory = async (theme: string, numPages: number): Promise<string[]> => {
    const prompt = `あなたは子供向けの絵本作家です。以下のテーマを元に、${numPages}ページの短い絵本の物語を作成してください。\nテーマ： ${theme}`;
    console.log("DEBUG: Generating story with prompt:", prompt);
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await getAiInstance().models.generateContent({
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

            console.log("DEBUG: Raw story response from API:", response);
            const result = JSON.parse(response.text);
            console.log("DEBUG: Parsed story result:", result);

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
  characterImages: File[],
  style: PictureBookStyle,
  numPages: number
): Promise<BookPage[]> => {
  console.log("DEBUG: Starting generatePictureBook process...");
  const storyParts = await generateStory(theme, numPages);
  
  if (storyParts.length === 0) {
    console.error("DEBUG: Story generation resulted in 0 parts. Aborting.");
    throw new Error("物語の生成に失敗しました。");
  }
  console.log(`DEBUG: Successfully generated ${storyParts.length} story parts.`);

  const pages: BookPage[] = [];
  const originalImages = await filesToOriginalImages(characterImages);
  console.log(`DEBUG: ${originalImages.length} character image(s) converted to Base64.`);
  
  for (let i = 0; i < storyParts.length; i++) {
    const storyPart = storyParts[i];
    
    const prompt = `あなたは絵本作家兼イラストレーターです。提供された子供の絵に描かれているキャラクターたちを使って、物語に合った絵本の1ページを作成してください。
元の絵のキャラクターたちの見た目や雰囲気を尊重し、物語の場面に合わせてポーズや表情を変えてください。複数のキャラクターがいる場合は、お互いに関わり合うように描いてください。
絵本のスタイルは「${style}」でお願いします。
このページの物語は以下の通りです: 「${storyPart}」
子供たちが見てわくわくするような、カラフルで魅力的な絵にしてください。
重要：生成する画像には、いかなる文字やテキストも絶対に含めないでください。イラストのみを生成してください。`;

    console.log(`DEBUG: [Page ${i + 1}] Generating image with prompt:`, prompt);

    let pageGenerated = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const imageParts = originalImages.map(img => ({
                inlineData: { data: img.base64, mimeType: img.mimeType }
            }));

            const response = await getAiInstance().models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        ...imageParts,
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
            
            console.log(`DEBUG: [Page ${i + 1}] Raw image response from API (Attempt ${attempt + 1}):`, response);
            const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);

            if (imagePart && imagePart.inlineData) {
                console.log(`DEBUG: [Page ${i + 1}] Found image part in response.`);
                const newPage = {
                    id: i,
                    text: storyPart,
                    imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
                    originalImages: originalImages,
                };
                pages.push(newPage);
                console.log(`DEBUG: [Page ${i + 1}] Successfully created page data.`, newPage);
                pageGenerated = true;
                break; 
            } else {
                console.warn(`DEBUG: [Page ${i + 1}] Image part not found in response. Retrying... (Attempt ${attempt + 1})`, response);
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
        console.error(`DEBUG: [Page ${i + 1}] Failed to generate page after all retries.`);
        throw new Error(`ページ ${i + 1} の生成に複数回失敗しました。`);
    }
  }

  console.log("DEBUG: Finished generatePictureBook process successfully. Returning pages:", pages);
  return pages;
};

export const regeneratePageImage = async (
    storyPart: string,
    originalImages: OriginalImage[],
    style: PictureBookStyle
): Promise<string> => {
    const prompt = `あなたは絵本作家兼イラストレーターです。子供たちが描いた複数の絵と物語の一部を元に、素晴らしい絵本の1ページを「再生成」してください。
元の絵のキャラクターたちの雰囲気や特徴を尊重しつつ、物語に合わせてプロのイラストレーターのように描き直してください。
絵本のスタイルは「${style}」でお願いします。
このページの物語は以下の通りです: 「${storyPart}」
先ほどとは少し違う、新しいアイデアで描いてみてください。子供たちがもっと驚くような、クリエイティブな絵をお願いします。
重要：生成する画像には、いかなる文字やテキストも絶対に含めないでください。イラストのみを生成してください。`;

    console.log("DEBUG: Starting regeneratePageImage process with prompt:", prompt);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const imageParts = originalImages.map(img => ({
                inlineData: { data: img.base64, mimeType: img.mimeType }
            }));

            const response = await getAiInstance().models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        ...imageParts,
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            console.log(`DEBUG: Raw image regeneration response from API (Attempt ${attempt + 1}):`, response);
            const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
            if (imagePart && imagePart.inlineData) {
                const newImageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                console.log("DEBUG: Successfully regenerated image. Returning new URL:", newImageUrl);
                return newImageUrl;
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
    
    console.error("DEBUG: Failed to regenerate image after all retries.");
    throw new Error('画像の再生成に失敗しました。AIが応答しませんでした。');
};