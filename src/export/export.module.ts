import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ZipExportService } from './zip-export.service';
import { SpringGeneratorService } from './spring-generator.service';
import { ExportController } from './export.controller';
import { DiagramsModule } from 'src/diagrams/diagrams.module';

@Module({
  providers: [ExportService, ZipExportService, SpringGeneratorService],
  controllers: [ExportController],
  imports: [DiagramsModule],
})
export class ExportModule {}
