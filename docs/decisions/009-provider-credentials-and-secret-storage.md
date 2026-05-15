# Decision 009: Provider Credentials and Secret Storage

**Date:** 2026-05-15

## Context

Phase 3 requires a secure data model and storage strategy for BYOK (Bring Your Own Key) provider credentials. Users supply their own AI API keys (OpenAI, Anthropic, etc.), which must be stored securely without exposing them in logs, database dumps, or API responses.

## Decisions

### Database Schema

- Single `provider_credentials` table with two mutually exclusive storage fields:
  - **`encrypted_api_key`** — AES-256-GCM encrypted blob for simple deployments (self-hosted).
  - **`key_reference`** — external secret store path/ARN for production deployments (AWS Secrets Manager, HashiCorp Vault).
- Both fields can be NULL, but at least one should be populated for a usable credential.
- Metadata fields (provider name, status, default model, etc.) are in plaintext and returned by API responses.

### Encryption Strategy

- **Algorithm:** AES-256-GCM (authenticated encryption with associated data).
- **Key derivation:** The raw `ENCRYPTION_KEY` env var is hashed with SHA-256 to produce a 256-bit key. This allows any 32+ byte hex string as the key.
- **IV:** 16 random bytes per encryption, stored alongside the ciphertext.
- **Serialization format:** `iv:ciphertext:tag` — colon-delimited hex strings.
- **No external encryption library** — uses Node.js built-in `crypto` module only.

### Secret Isolation Boundaries

| Layer               | Encrypted?      | Exposed in API? | Logged?          |
| ------------------- | --------------- | --------------- | ---------------- |
| `encrypted_api_key` | ✅ AES-256-GCM  | ❌ Never        | ❌ Never         |
| `key_reference`     | N/A (reference) | ❌ Never        | ❌ Never         |
| `provider`          | ❌              | ✅              | ✅ (as metadata) |
| `status`            | ❌              | ✅              | ✅               |
| `default_model`     | ❌              | ✅              | ✅               |
| `last_verified_at`  | ❌              | ✅              | ✅               |

### Ownership and Scoping

- `user_id` is required — every credential belongs to a user (even before auth is implemented, this creates a clear ownership model).
- `project_id` is optional — when set, the credential is scoped to a specific project. When null, it's available to all projects for that user.
- A user can have multiple credentials for the same provider (e.g., different projects use different API keys).

### Provider Compatibility

- The `provider` column uses an enum (`openai`, `anthropic`, `google`, `aws_bedrock`, `azure_openai`, `custom`) that can be extended.
- `models_available` stores a JSON array of model IDs that the provider offers.
- `metadata` stores provider-specific configuration (endpoint URLs, organization IDs, etc.) as JSON.

## Frozen Assumptions

- The `ENCRYPTION_KEY` environment variable must be set for encryption/decryption to work. Without it, encrypted credentials cannot be read.
- No provider API calls are implemented yet. The credential model is storage-only until the provider adapter layer is built.
- The `encrypted_api_key` and `key_reference` fields are mutually exclusive in practice but both are nullable in the schema to allow migration between strategies.
- Secret values are never logged. Any logging of credential objects must strip the `encrypted_api_key` and `key_reference` fields.

## Status

Accepted.
