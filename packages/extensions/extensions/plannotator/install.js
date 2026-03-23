const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const tar = require('tar');

const extDir = __dirname;
const tmpDir = path.join(extDir, 'tmp-extract');
const htmlDest = path.join(extDir, 'plannotator.html');
const reviewHtmlDest = path.join(extDir, 'review-editor.html');

// Pack the @plannotator/pi-extension package and get the filename
const tgzFilename = childProcess
  .execSync('npm pack @plannotator/pi-extension', { cwd: extDir, encoding: 'utf-8' })
  .trim();

const tgzFile = path.join(extDir, tgzFilename);

// Create temp directory for extraction
fs.mkdirSync(tmpDir, { recursive: true });

// Extract the tgz file using npm tar package
tar.extract({
  file: tgzFile,
  cwd: tmpDir,
  sync: true
});

// Copy plannotator.html from package to extension directory
const htmlSrc = path.join(tmpDir, 'package', 'plannotator.html');
fs.copyFileSync(htmlSrc, htmlDest);

// Copy review-editor.html from package to extension directory
const reviewHtmlSrc = path.join(tmpDir, 'package', 'review-editor.html');
fs.copyFileSync(reviewHtmlSrc, reviewHtmlDest);

// Clean up
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.rmSync(tgzFile, { force: true });

console.log('Extracted plannotator.html and review-editor.html successfully');
