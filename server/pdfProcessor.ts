import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function extractPdfCover(pdfPath: string, outputPath: string): Promise<string> {
  try {
    const outputDir = path.dirname(outputPath);
    const baseName = path.basename(outputPath, '.png');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const tempOutputPrefix = path.join(outputDir, baseName);
    
    await execAsync(
      `pdftoppm -png -f 1 -l 1 -scale-to 800 "${pdfPath}" "${tempOutputPrefix}"`
    );
    
    const generatedFile = `${tempOutputPrefix}-1.png`;
    
    if (fs.existsSync(generatedFile)) {
      fs.renameSync(generatedFile, outputPath);
    } else {
      const altFile = `${tempOutputPrefix}-01.png`;
      if (fs.existsSync(altFile)) {
        fs.renameSync(altFile, outputPath);
      } else {
        throw new Error('pdftoppm did not generate expected output file');
      }
    }
    
    return outputPath;
  } catch (error) {
    console.error('Error extracting PDF cover:', error);
    throw error;
  }
}

export async function extractCoverFromFile(filePath: string, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, ext);
  const coverFilename = `${baseName}-${Date.now()}.png`;
  const outputPath = path.join('uploads', 'covers', coverFilename);
  
  if (ext === '.pdf') {
    await extractPdfCover(filePath, outputPath);
    return `/uploads/covers/${coverFilename}`;
  }
  
  throw new Error(`Unsupported file type: ${ext}. Only PDF files are supported for cover extraction.`);
}
