import type { FullProviderCredential } from "../../domains/provider-credentials.js";
import { encrypt, decrypt, serializeEncrypted, parseEncrypted } from "../secrets/encryption.js";

export interface CredentialStore {
  list(): FullProviderCredential[];
  get(id: string): FullProviderCredential | undefined;
  insert(c: FullProviderCredential): void;
  update(id: string, c: Partial<FullProviderCredential>): void;
  remove(id: string): void;
}

export function createInMemoryCredentialStore(): CredentialStore {
  const items: FullProviderCredential[] = [];

  return {
    list() {
      return items.map(stripSecrets);
    },
    get(id) {
      const found = items.find((c) => c.id === id);
      return found ? stripSecrets(found) : undefined;
    },
    insert(c) {
      items.push(c);
    },
    update(id, partial) {
      const existing = items.find((c) => c.id === id);
      if (existing) Object.assign(existing, partial);
    },
    remove(id) {
      const existing = items.find((c) => c.id === id);
      if (existing) {
        const idx = items.indexOf(existing);
        if (idx !== -1) items.splice(idx, 1);
      }
    },
  };
}

function stripSecrets(c: FullProviderCredential): FullProviderCredential {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedApiKey: _key, keyReference: _ref, ...rest } = c;
  return rest as FullProviderCredential;
}

let _store: CredentialStore | null = null;

export function getCredentialStore(): CredentialStore {
  if (!_store) _store = createInMemoryCredentialStore();
  return _store;
}

export function encryptKey(plaintext: string): string {
  const payload = encrypt(plaintext);
  return serializeEncrypted(payload);
}

export function decryptKey(encrypted: string): string {
  return decrypt(parseEncrypted(encrypted));
}
