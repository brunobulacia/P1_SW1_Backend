import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DiagramInvitesService } from './diagram_invites.service';
import type { CreateDiagramInviteDto } from './dto/create-diagram_invite.dto';
import type { UpdateDiagramInviteDto } from './dto/update-diagram_invite.dto';

@Controller('diagram-invites')
export class DiagramInvitesController {
  constructor(private readonly diagramInvitesService: DiagramInvitesService) {}

  @Post()
  create(@Body() createDiagramInviteDto: CreateDiagramInviteDto) {
    return this.diagramInvitesService.create(createDiagramInviteDto);
  }

  @Get()
  findAll() {
    return this.diagramInvitesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagramInvitesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDiagramInviteDto: UpdateDiagramInviteDto,
  ) {
    return this.diagramInvitesService.update(id, updateDiagramInviteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diagramInvitesService.remove(id);
  }

  @Get('token/:token')
  findByToken(@Param('token') token: string) {
    return this.diagramInvitesService.getDiagramByInviteToken(token);
  }
}
