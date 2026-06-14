import fs from 'fs';
import path from 'path';

const E2E_DATA_DIR = path.join(__dirname, '.test-data');

const globalSetup = async (): Promise<void> => {
  console.log('🧹 Cleaning E2E test data directory...');

  if (fs.existsSync(E2E_DATA_DIR)) {
    fs.rmSync(E2E_DATA_DIR, { recursive: true, force: true });
  }

  console.log('✅ E2E test data directory cleaned');
};

export default globalSetup;
