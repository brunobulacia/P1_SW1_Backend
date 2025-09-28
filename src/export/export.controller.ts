import {
  Controller,
  Get,
  Query,
  Res,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import { ExportService } from './export.service';
import { ZipExportService } from './zip-export.service';
import { SpringGeneratorService } from './spring-generator.service';
import { DiagramsService } from 'src/diagrams/diagrams.service';
import type { Response } from 'express';
import * as path from 'path';

@Controller('export')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly zipExportService: ZipExportService,
    private readonly springGeneratorService: SpringGeneratorService,
    private readonly diagramsService: DiagramsService,
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

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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

  @Post('generate-spring')
  async generateSpringFromModel(@Body() body: any, @Res() res: Response) {
    // body should contain the 'model' object
    const model = body.model || body;
    // generate into a temp directory
    const os = require('os');
    const tmp = path.join(os.tmpdir(), `generated-demo-${Date.now()}`);
    this.ensureDir(tmp);
    await this.springGeneratorService.generateFromModel(model, tmp);
    // zip the generated temp folder and send
    const zipFilePath = path.join(
      os.tmpdir(),
      `generated-demo-${Date.now()}.zip`,
    );
    await this.zipExportService.exportFolderAsZip(tmp, zipFilePath);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="demo_generated.zip"',
    });
    const zipStream = fs.createReadStream(zipFilePath);
    zipStream.pipe(res);
    zipStream.on('end', () => {
      // cleanup
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.unlink(zipFilePath, () => {});
    });
  }

  @Get('generate-spring/:id')
  async generateSpringFromDiagram(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // fetch diagram by id to obtain model
    const diagram = await this.diagramsService.findOne(id).catch(() => null);
    if (!diagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }
    const model = diagram.model as any;

    // generate into a temp directory
    const os = require('os');
    const tmp = path.join(os.tmpdir(), `generated-demo-${Date.now()}`);
    this.ensureDir(tmp);
    await this.springGeneratorService.generateFromModel(model, tmp);
    // zip the generated temp folder and send
    const zipFilePath = path.join(
      os.tmpdir(),
      `generated-demo-${Date.now()}.zip`,
    );
    await this.zipExportService.exportFolderAsZip(tmp, zipFilePath);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="demo_generated.zip"',
    });
    const zipStream = fs.createReadStream(zipFilePath);
    zipStream.pipe(res);
    zipStream.on('end', () => {
      // cleanup
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.unlink(zipFilePath, () => {});
    });
  }
}
