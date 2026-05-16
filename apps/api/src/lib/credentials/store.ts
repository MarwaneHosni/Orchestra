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
  const byId = new Map<string, FullProviderCredential>();

  return {
    list() {
      return [...byId.values()].map(stripSecrets);
    },
    get(id) {
      const found = byId.get(id);
      return found ? stripSecrets(found) : undefined;
    },
    insert(c) {
      byId.set(c.id, c);
    },
    update(id, partial) {
      const existing = byId.get(id);
      if (existing) Object.assign(existing, partial);
    },
    remove(id) {
      byId.delete(id);
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
