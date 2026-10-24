// Native release assets generated from the Parts Connect blue PCLOGO artwork.
// Never render the retired red Frontier globe; the brand source is mandatory.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const source = path.join(__dirname, '..', 'assets', 'branding', 'PCLOGO.png');
const dest = path.join(__dirname, '..', 'assets', 'native');
const navy = '#0B2A52';
if (!fs.existsSync(source)) throw new Error('Parts Connect PCLOGO.png is missing; refusing to generate fallback branding.');
fs.mkdirSync(dest, { recursive: true });

async function run() {
  const image = sharp(source);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error('PCLOGO.png is invalid.');
  const logo = await image.png().toBuffer();

  // Solid full-bleed launcher icon.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: await sharp(logo).resize(750, 750, { fit: 'contain' }).toBuffer(), gravity: 'centre' }])
    .png().toFile(path.join(dest, 'icon.png'));

  // Android adaptive icon foreground, transparent with launcher-safe inset.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
    .composite([{ input: await sharp(logo).resize(585, 585, { fit: 'contain' }).toBuffer(), gravity: 'centre' }])
    .png().toFile(path.join(dest, 'adaptive-foreground.png'));

  // White silhouette of the brand silhouette for themed and system notification icons.
  const alpha = await sharp(logo).resize(250, 250, { fit: 'contain' }).ensureAlpha().extractChannel(3).toBuffer();
  const whiteMask = await sharp({ create: { width: 250, height: 250, channels: 4, background: '#FFFFFF' } })
    .joinChannel(alpha).png().toBuffer();
  await sharp({ create: { width: 432, height: 432, channels: 4, background: '#00000000' } })
    .composite([{ input: whiteMask, gravity: 'centre' }]).png().toFile(path.join(dest, 'adaptive-monochrome.png'));
  await sharp({ create: { width: 96, height: 96, channels: 4, background: '#00000000' } })
    .composite([{ input: await sharp(whiteMask).resize(72, 72).toBuffer(), gravity: 'centre' }])
    .png().toFile(path.join(dest, 'notification-icon.png'));

  // Embedded native splash displays the same branding while OTA checks.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: navy } })
    .composite([{ input: await sharp(logo).resize(580, 580, { fit: 'contain' }).toBuffer(), gravity: 'centre' }])
    .png().toFile(path.join(dest, 'splash.png'));
  console.log('Generated Parts Connect blue native assets from PCLOGO.png.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
