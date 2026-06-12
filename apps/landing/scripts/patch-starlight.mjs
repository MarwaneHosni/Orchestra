import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Postinstall script to patch Starlight v0.36.3 for:
 * 1. head.ts null check (prevents crash on missing metadata)
 * 2. index.ts route prefix for docs
 */

const STARLIGHT_PATH = join(
  __dirname,
  '../node_modules',
  '@astrojs/starlight'
);

function patchHeadTs() {
  const path = join(STARLIGHT_PATH, 'head.ts');
  const content = readFileSync(path, 'utf8');
  
  // Add null check for metadata
  if (content.includes('metadata?.url')) return; // Already patched
  
  const patched = content.replace(
    /const metadata = await getHeadMetadata\(Astro\);/,
    `const metadata = await getHeadMetadata(Astro);\n  if (!metadata) return;`
  );
  
  writeFileSync(path, patched);
  console.log('✓ Patched head.ts');
}

function patchIndexTs() {
  const path = join(STARLIGHT_PATH, 'index.ts');
  const content = readFileSync(path, 'utf8');
  
  // Add docs prefix for routes
  if (content.includes("prefix: '/docs'")) return; // Already patched
  
  const patched = content.replace(
    /routes: \[/,
    `routes: [\n    { pattern: '/docs/[...slug]', entryPoint: 'starlight/index.astro' }`
  );
  
  writeFileSync(path, patched);
  console.log('✓ Patched index.ts');
}

try {
  patchHeadTs();
  patchIndexTs();
  console.log('Starlight patches applied successfully');
} catch (err) {
  console.error('Failed to apply Starlight patches:', err);
  process.exit(1);
}
