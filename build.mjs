import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
cpSync('manifest.json', 'dist/manifest.json');
cpSync('src/content/styles.css', 'dist/styles.css');

const watch = process.argv.includes('--watch');
const options = {
  bundle: true,
  format: 'esm',
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
