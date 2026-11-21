import { SESSION_ACCOUNT_PREFIX } from "../config";
import { bufferFromBase64, bufferToBase64 } from "./encoding/buffer";

// Per-DC credentials such as `dc1_auth_key`, `dc5_server_salt`
const DC_CREDENTIAL_RE = /^dc\d+_(auth_key|server_salt)$/;
// Per-DC auth keys such as `dc1_auth_key`, `dc5_auth_key`
const DC_AUTH_KEY_RE = /^dc\d+_auth_key$/;

export function hasStoredAccountAndAuthKey(): boolean {
  let hasAccount = false;
  let hasAuthKey = false;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith(SESSION_ACCOUNT_PREFIX)) {
      hasAccount = true;
    } else if (DC_AUTH_KEY_RE.test(key)) {
      hasAuthKey = true;
    }

    if (hasAccount && hasAuthKey) return true;
  }

  return false;
}

export function encrypt(text: string): string {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(text);

  // 对每个字节加10
  const modifiedBuffer = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    modifiedBuffer[i] = (buffer[i] + 10) % 256;
  }

  return bufferToBase64(modifiedBuffer);
}

export function decrypt(ciphertext: string): string {
  const buffer = bufferFromBase64(ciphertext);

  // 对每个字节减10
  const decodedBuffer = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    decodedBuffer[i] = (buffer[i] - 10 + 256) % 256;
  }

  return new TextDecoder().decode(decodedBuffer);
}

export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
): string {
  const text = JSON.stringify(obj);
  return encrypt(text);
}

export function encryptObjectFormat() {
  const dc = localStorage.getItem("dc");
  const uphone = localStorage.getItem("uphone");
  const user_auth = localStorage.getItem("user_auth");

  const text: Record<string, unknown> = {
    uphone,
    user_auth,
    dc,
  };

  // Collect every account slot (`account1`, ...) and every per-DC credential
  // (`dc1_auth_key`, `dc5_server_salt`, ...) stored under their naming pattern
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith(SESSION_ACCOUNT_PREFIX)) {
      text[key] = localStorage.getItem(key);
    } else if (DC_CREDENTIAL_RE.test(key)) {
      text[key] = JSON.stringify(`"${localStorage.getItem(key)}"`);
    }
  }

  return encryptObject(text);
}

export function decryptObject<T extends Record<string, unknown>>(
  ciphertext: string,
): T {
  const text = decrypt(ciphertext);
  const json = text.replace(new RegExp("\\\\\\\\", "g"), "\\");
  return JSON.parse(json) as T;
}

export function decryptObjectFormat(ciphertext: string) {
  const data = decryptObject<Record<string, unknown>>(ciphertext);

  for (const [key, value] of Object.entries(data)) {
    // Skip fields that were absent from `localStorage` at encrypt time
    if (value === null || value === undefined) continue;

    if (DC_CREDENTIAL_RE.test(key)) {
      // Reverse the `JSON.stringify(`"${value}"`)` wrapping applied on encrypt
      const unwrapped = JSON.parse(value as string) as string;
      localStorage.setItem(key, unwrapped.slice(1, -1));
    } else {
      localStorage.setItem(key, String(value));
    }
  }
}
