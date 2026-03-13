import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, '../src/web-sveltekit/build');
const dest = path.join(__dirname, '../public/webui');

if (!fs.existsSync(src)) {
  console.error('SvelteKit build not found. Run "npm run build:webui" first.');
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}

fs.cpSync(src, dest, { recursive: true });

console.log('WebUI copied to public/webui/');
