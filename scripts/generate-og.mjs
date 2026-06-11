import sharp from 'sharp';

await sharp('assets/og-image.svg', { density: 150 })
  .resize(1200, 630)
  .png()
  .toFile('public/og-image.png');
console.log('public/og-image.png written');
