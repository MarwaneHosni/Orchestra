import { describe, expect, it, beforeAll } from "vitest";
import { encrypt, decrypt, serializeEncrypted, parseEncrypted, EncryptionError } from "./encryption.js";

const TEST_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

describe("encrypt / decrypt", () => {
  it("roundtrips a plaintext string", () => {
    const original = "sk-ant-my-secret-api-key-12345";
    const encrypted = encrypt(original);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(original);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertexts each time (different IV)", () => {
    const plaintext = "same-value";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("throws EncryptionError with wrong key", () => {
    process.env.ENCRYPTION_KEY = "0000000000000000000000000000000000000000000000000000000000000000";
    const encrypted = encrypt("test");
    process.env.ENCRYPTION_KEY = TEST_KEY;
    expect(() => decrypt(encrypted)).toThrow(EncryptionError);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("handles special characters", () => {
    const original = "sk-ants!@#$%^&*()_+-=[]{}|;':\",./<>?`~한글日本語";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });
});

describe("serializeEncrypted / parseEncrypted", () => {
  it("roundtrips through serialized format", () => {
    const original = encrypt("my-key");
    const serialized = serializeEncrypted(original);
    const parsed = parseEncrypted(serialized);
    const decrypted = decrypt(parsed);
    expect(decrypted).toBe("my-key");
  });

  it("throws on invalid format", () => {
    expect(() => parseEncrypted("invalid")).toThrow(EncryptionError);
  });
});

describe("encrypt without key", () => {
  it("throws EncryptionError when ENCRYPTION_KEY is not set", () => {
    const key = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow(EncryptionError);
    process.env.ENCRYPTION_KEY = key;
  });
});
