//export.controller.ts
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
import { ZipExportService } from './zip-export.service';
import { SpringGeneratorService } from './spring-generator.service';
import { DiagramsService } from 'src/diagrams/diagrams.service';
import type { Response } from 'express';
import * as path from 'path';

@Controller('export')
export class ExportController {
  constructor(
    private readonly zipExportService: ZipExportService,
    private readonly springGeneratorService: SpringGeneratorService,
    private readonly diagramsService: DiagramsService,
  ) {}

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Genera un proyecto Spring directamente desde un modelo enviado en el body
  @Post('generate-spring')
  async generateSpringFromModel(@Body() body: any, @Res() res: Response) {
    const model = body?.model || body;

    const os = require('os');
    const tmp = path.join(os.tmpdir(), `generated-demo-${Date.now()}`);
    this.ensureDir(tmp);

    await this.springGeneratorService.generateFromModel(model, tmp);

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
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.unlink(zipFilePath, () => {});
      } catch {}
    });
  }

  // Genera un proyecto Spring leyendo el modelo guardado de un diagrama por ID
  @Get('generate-spring/:id')
  async generateSpringFromDiagram(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const diagram = await this.diagramsService.findOne(id).catch(() => null);
    if (!diagram)
      throw new NotFoundException(`Diagram with id ${id} not found`);

    const model = (diagram as any).model;

    const os = require('os');
    const tmp = path.join(os.tmpdir(), `generated-demo-${Date.now()}`);
    this.ensureDir(tmp);

    await this.springGeneratorService.generateFromModel(model, tmp);

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
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.unlink(zipFilePath, () => {});
      } catch {}
    });
  }
}
