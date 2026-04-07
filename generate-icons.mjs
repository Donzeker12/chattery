import sharp from 'sharp';
import { readFileSync } from 'fs';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// iOS Splash Screen sizes
const splashSizes = [
    { width: 2048, height: 2732, name: 'splash-2048x2732.png' }, // iPad Pro 12.9" (2018+)
    { width: 1668, height: 2224, name: 'splash-1668x2224.png' }, // iPad Pro 11"
    { width: 1536, height: 2048, name: 'splash-1536x2048.png' }, // iPad Pro 10.5"
    { width: 1125, height: 2436, name: 'splash-1125x2436.png' }, // iPhone X/XS
    { width: 1242, height: 2208, name: 'splash-1242x2208.png' }, // iPhone 6+/7+/8+
    { width: 750, height: 1334, name: 'splash-750x1334.png' },   // iPhone 6/7/8
    { width: 640, height: 1136, name: 'splash-640x1136.png' }    // iPhone 5/SE
];

const svgBuffer = readFileSync('public/icon.svg');

async function generateIcons() {
    console.log('🎨 Generating PWA icons...');
    
    // Generate regular PWA icons
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
    
    console.log('\n🖼️ Generating iOS splash screens...');
    
    // Generate iOS splash screens
    for (const splash of splashSizes) {
        // Create background with brand gradient
        const background = await sharp({
            create: {
                width: splash.width,
                height: splash.height,
                channels: 4,
                background: { r: 59, g: 130, b: 246 } // Blue theme color
            }
        }).png();
        
        // Resize icon to be centered and appropriately sized (1/4 of screen width)
        const iconSize = Math.min(splash.width, splash.height) / 4;
        const resizedIcon = await sharp(svgBuffer)
            .resize(Math.round(iconSize), Math.round(iconSize))
            .png()
            .toBuffer();
        
        // Composite icon on background
        await background
            .composite([
                {
                    input: resizedIcon,
                    left: Math.round((splash.width - iconSize) / 2),
                    top: Math.round((splash.height - iconSize) / 2)
                }
            ])
            .png()
            .toFile(`public/${splash.name}`);
        
        console.log(`✓ Generated ${splash.name}`);
    }
    
    console.log('\n✨ All PWA assets generated successfully!');
    console.log('📱 Your app now has:');
    console.log('   • Complete icon set for all devices');
    console.log('   • iOS splash screens for smooth launch');
    console.log('   • Optimized favicon and apple-touch-icon');
}

generateIcons().catch(console.error);
