import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
<<<<<<< HEAD
=======
  NotFoundException,
>>>>>>> d31240d (Antes del desarollo colaborativo)
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
  findAll(@Query('userId') userId?: string) {
    if (userId) {
      return this.diagramsService.findByOwner(userId);
    }
    throw new NotFoundException('UserId query parameter is required');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagramsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDiagramDto: UpdateDiagramDto) {
    return this.diagramsService.update(id, updateDiagramDto);
  }

  @Delete('bulk')
  bulkDelete(@Body('ids') ids: string[]) {
    return this.diagramsService.bulkDelete(ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diagramsService.remove(id);
  }

  @Get(':userId')
  findByUser(@Query('userId') userId: string) {
    return this.diagramsService.findByOwner(userId);
  }
}
