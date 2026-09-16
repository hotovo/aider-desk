import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const localesDir = join(process.cwd(), 'packages', 'common', 'src', 'locales');

const files = readdirSync(localesDir).filter((file) => file.endsWith('.json'));

let hasErrors = false;

for (const file of files) {
  const filePath = join(localesDir, file);
  try {
    JSON.parse(readFileSync(filePath, 'utf-8'));
    console.log(`✔ ${file} is valid`);
  } catch (error) {
    hasErrors = true;
    console.error(`✖ ${file}: ${error.message}`);
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(`All ${files.length} locale files are valid.`);
