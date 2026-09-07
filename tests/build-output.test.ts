import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const CLASSIC_SCRIPTS = [
  'dist/capture.js',
  'dist/content.js',
  'dist/options.js',
  'dist/popup.js',
];

describe('build output: classic script entries must not contain ESM syntax', () => {
  it('dist exists (run `npm run build` first)', () => {
    expect(existsSync('dist/manifest.json')).toBe(true);
  });

  for (const file of CLASSIC_SCRIPTS) {
    it(`${file} has no top-level import/export (classic scripts cannot parse them)`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src, `${file} contains a top-level export statement`).not.toMatch(/^[ \t]*export[ \t]*[,{]/m);
      expect(src, `${file} contains a top-level import statement`).not.toMatch(/^[ \t]*import[ \t]+/m);
    });
  }
});
