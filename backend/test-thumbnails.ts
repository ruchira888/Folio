import { generateThumbnails } from './src/services/thumbnailService';
import { storage } from './src/index';
import fs from 'fs';
import path from 'path';

async function test() {
  const testFileId = 'test-pdf';
  const pdfPath = path.resolve('test.pdf'); // I need a test PDF
  
  // Create a dummy PDF if not exists
  if (!fs.existsSync(pdfPath)) {
    console.log('test.pdf not found. Please provide a test.pdf in backend folder.');
    return;
  }

  const buffer = fs.readFileSync(pdfPath);
  
  storage.saveRecord({
    id: testFileId,
    originalName: 'test.pdf',
    url: 'local',
    uploadedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000000),
    sizeMb: buffer.length / (1024 * 1024)
  });

  // Mock getBuffer
  const originalGetBuffer = storage.getBuffer;
  storage.getBuffer = async () => buffer;

  try {
    console.log('Starting test...');
    const result = await generateThumbnails(testFileId);
    console.log(`Success! Generated ${result.pages.length} thumbnails.`);
    // console.log(result.pages[0].thumbnailUrl.substring(0, 50) + '...');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    storage.getBuffer = originalGetBuffer;
  }
}

test();
