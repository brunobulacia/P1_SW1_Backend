import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DiagramMembersService } from './diagram_members.service';
import type { CreateDiagramMemberDto } from './dto/create-diagram_member.dto';
import type { UpdateDiagramMemberDto } from './dto/update-diagram_member.dto';

@Controller('diagram-members')
export class DiagramMembersController {
  constructor(private readonly diagramMembersService: DiagramMembersService) {}

  @Post()
  create(@Body() createDiagramMemberDto: CreateDiagramMemberDto) {
    return this.diagramMembersService.create(createDiagramMemberDto);
  }

  @Get()
  findAll() {
    return this.diagramMembersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagramMembersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDiagramMemberDto: UpdateDiagramMemberDto,
  ) {
    return this.diagramMembersService.update(id, updateDiagramMemberDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diagramMembersService.remove(id);
  }
}
