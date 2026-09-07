import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
cpSync('manifest.json', 'dist/manifest.json');
cpSync('src/content/styles.css', 'dist/styles.css');
for (const [src, dest] of [
  ['src/options/options.html', 'dist/options.html'],
  ['src/popup/popup.html', 'dist/popup.html'],
  ['src/popup/popup.css', 'dist/popup.css'],
  ['src/options/options.css', 'dist/options.css'],
]) {
  if (existsSync(src)) {
    cpSync(src, dest);
  }
}

const watch = process.argv.includes('--watch');
const options = {
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  outdir: 'dist',
  entryPoints: {
    'content': 'src/content/index.ts',
    'capture': 'src/content/capture.ts',
    'background': 'src/background/index.ts',
    'options': 'src/options/options.ts',
    'popup': 'src/popup/popup.ts',
  },
};
if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching...');
} else {
  await esbuild.build(options);
  console.log('build ok');
}
