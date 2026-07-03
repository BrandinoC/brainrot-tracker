#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const FPS = 30;

const MODES = {
  short: {
    html: 'promo.html',
    output: 'RotVault-Preview.mp4',
    width: 1280,
    height: 720,
    framesDir: 'frames-short',
  },
  long: {
    html: 'promo-long.html',
    output: 'RotVault-Preview-Long.mp4',
    width: 1280,
    height: 720,
    framesDir: 'frames-long',
  },
  vertical: {
    html: 'promo-vertical.html',
    output: 'RotVault-TikTok.mp4',
    width: 1080,
    height: 1920,
    framesDir: 'frames-vertical',
  },
};

function parseModes(argv) {
  if (argv.includes('--all')) return ['short', 'long', 'vertical'];
  const modes = [];
  if (argv.includes('--long')) modes.push('long');
  if (argv.includes('--vertical')) modes.push('vertical');
  if (argv.includes('--short') || modes.length === 0) modes.push('short');
  return [...new Set(modes)];
}

async function recordMode(modeKey) {
  const mode = MODES[modeKey];
  const framesDir = path.join(ROOT, mode.framesDir);
  const promoHtml = path.join(ROOT, mode.html);
  const outputMp4 = path.join(ROOT, mode.output);

  if (!fs.existsSync(promoHtml)) {
    throw new Error(`Missing ${mode.html}`);
  }

  fs.mkdirSync(framesDir, { recursive: true });
  for (const file of fs.readdirSync(framesDir)) {
    if (file.endsWith('.png')) fs.unlinkSync(path.join(framesDir, file));
  }

  console.log(`\n=== Recording ${modeKey} (${mode.width}x${mode.height}) ===`);

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: mode.width,
      height: mode.height,
      deviceScaleFactor: 1,
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(pathToFileURL(promoHtml).href, { waitUntil: 'networkidle0' });

  const totalMs = await page.evaluate(() => window.__PROMO_TOTAL_MS__);
  const totalFrames = Math.ceil((totalMs / 1000) * FPS) + FPS;

  console.log(`Capturing ${totalFrames} frames (${(totalMs / 1000).toFixed(1)}s)...`);

  for (let i = 0; i < totalFrames; i += 1) {
    const framePath = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }

  await browser.close();

  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const result = spawnSync(
    ffmpeg,
    [
      '-y',
      '-framerate', String(FPS),
      '-i', path.join(framesDir, 'frame-%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '20',
      '-preset', 'medium',
      '-movflags', '+faststart',
      outputMp4,
    ],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${modeKey}`);
  }

  const sizeMb = (fs.statSync(outputMp4).size / (1024 * 1024)).toFixed(1);
  console.log(`Saved: ${mode.output} (${sizeMb} MB, ${(totalMs / 1000).toFixed(0)}s)`);
}

async function main() {
  const modes = parseModes(process.argv.slice(2));
  for (const mode of modes) {
    await recordMode(mode);
  }
  console.log('\nAll recordings complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
