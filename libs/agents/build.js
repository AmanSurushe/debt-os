const esbuild = require('esbuild');
const { glob } = require('glob');
const path = require('path');

async function build() {
  // Find all TypeScript files
  const entryPoints = await glob('src/**/*.ts', {
    cwd: __dirname,
    absolute: true,
  });

  // Build with esbuild
  await esbuild.build({
    entryPoints,
    outdir: path.join(__dirname, 'dist'),
    bundle: false,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    outbase: path.join(__dirname, 'src'),
  });

  console.log('Build completed successfully!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
