import sharp from 'sharp';
import { readFileSync } from 'fs';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgBuffer = readFileSync('public/icon.svg');

async function generateIcons() {
    console.log('Generating PWA icons...');
    
    for (const size of sizes) {
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(`public/icon-${size}x${size}.png`);
        
        console.log(`✓ Generated icon-${size}x${size}.png`);
    }
    
    // Generate apple-touch-icon
    await sharp(svgBuffer)
        .resize(180, 180)
        .png()
        .toFile('public/apple-touch-icon.png');
    
    console.log('✓ Generated apple-touch-icon.png');
    
    // Generate favicon
    await sharp(svgBuffer)
        .resize(32, 32)
        .png()
        .toFile('public/favicon.ico');
    
    console.log('✓ Generated favicon.ico');
    
    console.log('\n✨ All icons generated successfully!');
}

generateIcons().catch(console.error);
