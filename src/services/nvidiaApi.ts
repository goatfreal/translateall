import type { TranslationResult } from '../types';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

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

  // Optimized ultra-concise prompt for minimal latency in gaming
  const prompt = `You are a real-time game translator.
Extract visible subtitles, dialogue, or UI text in this game frame.
Translate directly into ${targetLangName}.
If no text is visible, output None.
Format:
Original: <in-game text>
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
              url: `data:image/jpeg;base64,${cleanBase64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 100,
  };

  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const latencyMs = Math.round(performance.now() - startTime);

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

  const data = await response.json();
  const rawContent: string = data.choices?.[0]?.message?.content || '';

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
    max_tokens: 80,
  };

  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const latencyMs = Math.round(performance.now() - startTime);

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

  const data = await response.json();
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
  // Check for Original: / Translation: format
  const origMatch = content.match(/Original:\s*(.+)/i);
  const transMatch = content.match(/Translation:\s*(.+)/i);

  if (transMatch) {
    return {
      detectedText: origMatch ? origMatch[1].trim() : '',
      translatedText: transMatch[1].trim(),
    };
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

  // Fallback: entire content is translation
  return {
    detectedText: '',
    translatedText: content.trim(),
  };
}
