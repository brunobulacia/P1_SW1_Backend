import { Injectable } from '@nestjs/common';
import { Blob } from 'buffer';
import * as fs from 'fs/promises';
import { DiagramsService } from 'src/diagrams/diagrams.service';

@Injectable()
export class ExportService {
  constructor(private readonly diagramsService: DiagramsService) {}

  async exportJavaFileAsBlob(filePath: string): Promise<Blob> {
    const fileBuffer = await fs.readFile(filePath);
    return new Blob([fileBuffer], { type: 'text/x-java-source' });
  }
}
