const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 7;

export function makeRoomCode() {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

export function normalizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .split('')
    .filter((ch) => ALPHABET.includes(ch))
    .slice(0, CODE_LENGTH)
    .join('');
}

export function isValidRoomCode(value) {
  return normalizeRoomCode(value).length === CODE_LENGTH;
}