import { Controller, Get, Query, Res } from '@nestjs/common';
import * as fs from 'fs';
import { ExportService } from './export.service';
import { ZipExportService } from './zip-export.service';
import type { Response } from 'express';
import * as path from 'path';

@Controller('export')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly zipExportService: ZipExportService,
  ) {}

  @Get('java')
  async getJavaFile(@Query('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(process.cwd(), 'files', filename);
    const blob = await this.exportService.exportJavaFileAsBlob(filePath);
    const buffer = Buffer.from(await blob.arrayBuffer());
    res.set({
      'Content-Type': 'text/x-java-source',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('demo-zip')
  async exportDemoZip(@Res() res: Response) {
    const zipFilePath = path.join(process.cwd(), 'demo.zip');
    await this.zipExportService.exportDemoFolderAsZip(zipFilePath);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="demo.zip"',
    });
    const zipStream = fs.createReadStream(zipFilePath);
    zipStream.pipe(res);
    zipStream.on('end', () => {
      fs.unlink(zipFilePath, () => {}); // Borra el zip temporalmente
    });
  }
}
