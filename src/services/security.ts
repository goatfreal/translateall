// Security & Obfuscation layer for Protect API Key in .ipa / .apk / Web builds

// Salt for runtime XOR obfuscation
const SALT = [0x54, 0x72, 0x61, 0x6e, 0x73, 0x6c, 0x61, 0x74, 0x65, 0x41, 0x6c, 0x6c]; // 'TranslateAll'

// Obfuscate a raw key
export function obfuscateKey(rawKey: string): string {
  if (!rawKey) return '';
  const bytes = new TextEncoder().encode(rawKey);
  const obfuscated = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    obfuscated[i] = bytes[i] ^ SALT[i % SALT.length];
  }
  let binary = '';
  for (let i = 0; i < obfuscated.byteLength; i++) {
    binary += String.fromCharCode(obfuscated[i]);
  }
  return btoa(binary);
}

// De-obfuscate in memory at runtime
export function deobfuscateKey(encoded: string): string {
  if (!encoded) return '';
  try {
    const raw = atob(encoded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i) ^ SALT[i % SALT.length];
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

// Key is injected via .env (local) or GitHub Secrets (CI/CD) to prevent leaks in public git
const EMBEDDED_OBFUSCATED_KEY = '';

export function getDefaultApiKey(): string {
  // 1. Check environment variable if injected via Vite build (e.g. CI/CD)
  const envKey = (import.meta as any).env?.VITE_NVIDIA_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().startsWith('nvapi-')) {
    return envKey.trim();
  }

  // 2. Decode embedded obfuscated key
  const decoded = deobfuscateKey(EMBEDDED_OBFUSCATED_KEY);
  if (decoded && decoded.startsWith('nvapi-')) {
    return decoded;
  }

  return '';
}

// Mask key for UI display (e.g. nvapi-••••••••••••yCV)
export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '••••••••';
  const prefix = key.slice(0, 6);
  const suffix = key.slice(-4);
  return `${prefix}${'•'.repeat(Math.max(6, key.length - 10))}${suffix}`;
}
