import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

const fontsDir = 'C:\\Windows\\Fonts';
const files = fs.readdirSync(fontsDir);
console.log(`Scanning ${files.length} files in ${fontsDir} for Devanagari support (0x092f)...`);

let foundCount = 0;
for (const file of files) {
  if (file.toLowerCase().endsWith('.ttf')) {
    const filePath = path.join(fontsDir, file);
    try {
      const fontBytes = fs.readFileSync(filePath);
      const font = fontkit.create(fontBytes);
      if ((font as any).hasGlyphForCodePoint(0x092f)) {
        console.log(`[Devanagari Support] FOUND: ${file} ("${font.postscriptName || font.fullName}")`);
        foundCount++;
      }
    } catch (err) {
      // ignore parsing errors for non-TTF files disguised as TTF
    }
  }
}

console.log(`Scan finished. Found ${foundCount} fonts with Devanagari support.`);
