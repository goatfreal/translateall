import type { TranslationResult } from '../types';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Universal network poster that uses native iOS/Android networking to avoid WebKit CORS 'Load failed' errors
async function postToNvidia(payload: any, apiKey: string): Promise<any> {
  const trimmedKey = apiKey.trim();

  // On Native iOS / Android (Capacitor), route through native NSURLSession / OkHttp
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.post({
        url: NVIDIA_API_URL,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmedKey}`,
        },
        data: payload,
      });

      if (res.status >= 200 && res.status < 300) {
        if (typeof res.data === 'string') {
          return JSON.parse(res.data);
        }
        return res.data;
      }

      let errorMsg = `NVIDIA API Hatası (${res.status})`;
      if (res.data) {
        if (typeof res.data === 'object') {
          errorMsg = res.data.detail || res.data.message || errorMsg;
        } else if (typeof res.data === 'string') {
          try {
            const p = JSON.parse(res.data);
            errorMsg = p.detail || p.message || errorMsg;
          } catch {
            errorMsg = res.data;
          }
        }
      }
      throw new Error(errorMsg);
    } catch (e: any) {
      if (e?.message && e.message.startsWith('NVIDIA API Hatası')) {
        throw e;
      }
      console.warn('Native CapacitorHttp failed, attempting standard fetch:', e);
    }
  }

  // Fallback for Electron / Web browsers
  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${trimmedKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `NVIDIA API Hatası (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.detail) message = parsed.detail;
      else if (parsed.message) message = parsed.message;
    } catch {
      if (errorBody) message = errorBody;
    }
    throw new Error(message);
  }

  return await response.json();
}

export async function translateImageFrame(
  base64Image: string,
  targetLangName: string,
  apiKey: string,
  model: string = 'nvidia/nemotron-3.5-super-vl-120b-a12b'
): Promise<TranslationResult | null> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('NVIDIA API Key girilmedi.');
  }

  const startTime = performance.now();

  // Strip data:image/...;base64, prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  // High performance game subtitle OCR & translation prompt
  const prompt = `You are a real-time game subtitle translator.
Read foreign game subtitles or dialogue in this cropped frame.
Translate directly into ${targetLangName}.
If no dialogue is visible, output None.
Format:
Original: <text>
Translation: <${targetLangName} text>`;

  const payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,{cleanBase64}`.replace('{cleanBase64}', cleanBase64),
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 400,
  };

  const data = await postToNvidia(payload, apiKey);
  const latencyMs = Math.round(performance.now() - startTime);

  const choice = data.choices?.[0]?.message;
  // Nemotron 3.5 Super VL outputs reasoning & final response in reasoning_content or content!
  const rawContent: string = choice?.content || choice?.reasoning_content || '';

  if (!rawContent || rawContent.trim() === '' || rawContent.trim().toLowerCase() === 'none') {
    return null;
  }

  const parsed = parseVisionResponse(rawContent, targetLangName);
  if (!parsed.translatedText) return null;

  return {
    id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    originalText: parsed.detectedText,
    translatedText: parsed.translatedText,
    context: 'Subtitle',
    sourceLanguage: 'Auto',
    targetLanguage: targetLangName,
    latencyMs,
  };
}

export async function translateText(
  text: string,
  targetLangName: string,
  apiKey: string,
  model: string = 'nvidia/riva-translate-4b-instruct-v2'
): Promise<TranslationResult> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('NVIDIA API Key girilmedi.');
  }

  const startTime = performance.now();

  const isRiva = model.includes('riva-translate');
  const prompt = isRiva
    ? `Translate to ${targetLangName}: ${text}`
    : `Translate the following dialogue into ${targetLangName}. Output only the translation:\n"${text}"`;

  const payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 120,
  };

  const data = await postToNvidia(payload, apiKey);
  const latencyMs = Math.round(performance.now() - startTime);

  let translatedText: string = data.choices?.[0]?.message?.content?.trim() || '';

  // Clean quotes if model added surrounding quotes
  if (translatedText.startsWith('"') && translatedText.endsWith('"')) {
    translatedText = translatedText.slice(1, -1);
  }

  return {
    id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    originalText: text,
    translatedText,
    context: 'Dialogue',
    sourceLanguage: 'Speech',
    targetLanguage: targetLangName,
    latencyMs,
  };
}

function parseVisionResponse(
  content: string,
  _targetLang: string
): { detectedText: string; translatedText: string } {
  // Use regex to find all matches, then pick the final clean output block
  const origMatches = Array.from(content.matchAll(/Original:\s*(.+)/gi));
  const transMatches = Array.from(content.matchAll(/Translation:\s*(.+)/gi));

  if (transMatches.length > 0) {
    const rawTrans = transMatches[transMatches.length - 1][1].trim();
    const rawOrig = origMatches.length > 0 ? origMatches[origMatches.length - 1][1].trim() : '';
    
    // Clean quotes, asterisks, brackets
    const cleanTrans = rawTrans.replace(/^["'*_`]+|["'*_`]+$/g, '').trim();
    const cleanOrig = rawOrig.replace(/^["'*_`]+|["'*_`]+$/g, '').trim();

    if (cleanTrans && cleanTrans.toLowerCase() !== 'none') {
      return {
        detectedText: cleanOrig,
        translatedText: cleanTrans,
      };
    }
  }

  // Check JSON format
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        detectedText: parsed.detectedText || parsed.originalText || '',
        translatedText: parsed.translatedText || parsed.translation || '',
      };
    }
  } catch {}

  // Fallback: If output doesn't contain thinking boilerplate
  if (!content.includes('The user wants') && !content.includes('Identify the text') && content.length < 250) {
    return {
      detectedText: '',
      translatedText: content.trim(),
    };
  }

  return {
    detectedText: '',
    translatedText: '',
  };
}
