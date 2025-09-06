import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
import type { CreateDiagramDto } from './dto/create-diagram.dto';
import type { UpdateDiagramDto } from './dto/update-diagram.dto';

@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Post()
  create(@Body() createDiagramDto: CreateDiagramDto) {
    return this.diagramsService.create(createDiagramDto);
  }

  @Get()
  findAll() {
    return this.diagramsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagramsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDiagramDto: UpdateDiagramDto) {
    return this.diagramsService.update(id, updateDiagramDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diagramsService.remove(id);
  }
}
