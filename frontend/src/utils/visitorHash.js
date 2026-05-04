/**
 * Identificador anônimo do navegador.
 *
 * Gera um UUID aleatório na primeira vez que o navegador acessa a página
 * e o persiste em localStorage. O `visitor_hash` enviado ao backend é o
 * SHA-256 desse UUID. Assim, dois aparelhos do mesmo modelo (mesma
 * timezone, idioma e resolução) ficam com hashes diferentes.
 *
 * Caso o localStorage esteja indisponível (ex.: navegador em modo restrito),
 * é mantido um id em memória apenas para o tempo de vida da aba — ainda
 * suficiente para evitar duas inscrições no mesmo carregamento.
 */

const STORAGE_KEY = 'meuracha:visitor-id';

let inMemoryFallbackId = '';

function isWindowAvailable() {
  return typeof window !== 'undefined';
}

function getStorage() {
  if (!isWindowAvailable()) return null;
  try {
    const probe = '__meuracha_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateVisitorId() {
  const storage = getStorage();
  if (storage) {
    let id = '';
    try {
      id = storage.getItem(STORAGE_KEY) || '';
    } catch {
      id = '';
    }
    if (!id) {
      id = generateUuid();
      try {
        storage.setItem(STORAGE_KEY, id);
      } catch {
        // ignora — usaremos o id em memória
      }
    }
    return id;
  }

  if (!inMemoryFallbackId) {
    inMemoryFallbackId = generateUuid();
  }
  return inMemoryFallbackId;
}

async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash estável e anônimo do navegador (SHA-256 hex, 64 caracteres).
 * Usado para limitar uma inscrição por aparelho por lista, sem login.
 */
export async function computeVisitorHash() {
  const visitorId = getOrCreateVisitorId();
  return sha256Hex(`meuracha-visitor-v2|${visitorId}`);
}

/**
 * Limpa o identificador persistido. Exposto para testes; em produção
 * normalmente não é necessário.
 */
export function _resetVisitorIdForTests() {
  inMemoryFallbackId = '';
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
  }
}
