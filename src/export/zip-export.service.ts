import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
// Use require for archiver to avoid 'archiver is not a function' at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');

@Injectable()
export class ZipExportService {
  async exportDemoFolderAsZip(zipFilePath: string): Promise<void> {
    // Use project root to locate the `demo` folder reliably
    const demoFolderPath = path.join(process.cwd(), 'demo');
    if (!fs.existsSync(demoFolderPath)) {
      throw new Error(`Demo folder not found at ${demoFolderPath}`);
    }
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        const bytes = archive.pointer();
        if (!bytes || bytes === 0) {
          return reject(new Error('Generated zip is empty'));
        }
        return resolve();
      });

      output.on('end', () => {
        // stream drained
      });

      archive.on('warning', (err: any) => {
        // log and continue for non-blocking warnings
        console.warn('Archiver warning', err);
      });

      archive.on('error', (err: any) => reject(err));

      archive.pipe(output);
      // Ensure directory path ends with slash to include contents reliably
      const dirPathToAdd = demoFolderPath.endsWith(path.sep)
        ? demoFolderPath
        : demoFolderPath + path.sep;
      archive.directory(dirPathToAdd, 'demo');
      archive.finalize();
    });
  }

  async exportFolderAsZip(
    folderPath: string,
    zipFilePath: string,
  ): Promise<void> {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder not found at ${folderPath}`);
    }
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        const bytes = archive.pointer();
        if (!bytes || bytes === 0) {
          return reject(new Error('Generated zip is empty'));
        }
        return resolve();
      });

      archive.on('warning', (err: any) => {
        console.warn('Archiver warning', err);
      });

      archive.on('error', (err: any) => reject(err));

      archive.pipe(output);
      const dirPathToAdd = folderPath.endsWith(path.sep)
        ? folderPath
        : folderPath + path.sep;
      archive.directory(dirPathToAdd, false);
      archive.finalize();
    });
  }
}
