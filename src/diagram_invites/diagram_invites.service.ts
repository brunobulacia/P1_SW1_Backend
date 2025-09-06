import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDiagramInviteDto } from './dto/create-diagram_invite.dto';
import { UpdateDiagramInviteDto } from './dto/update-diagram_invite.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DiagramInvite } from '@prisma/client';

@Injectable()
export class DiagramInvitesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    createDiagramInviteDto: CreateDiagramInviteDto,
  ): Promise<DiagramInvite> {
    const createdDiagramInvite = await this.prismaService.diagramInvite.create({
      data: createDiagramInviteDto,
    });

    if (!createdDiagramInvite) {
      throw new NotAcceptableException('Error creating diagram invite');
    }

    return createdDiagramInvite;
  }

  async findAll(): Promise<DiagramInvite[]> {
    const foundDiagramInvites =
      await this.prismaService.diagramInvite.findMany();
    if (!foundDiagramInvites) {
      throw new NotFoundException('Error fetching diagram invites');
    }
    return foundDiagramInvites;
  }

  async findOne(id: string): Promise<DiagramInvite> {
    const foundDiagramInvite =
      await this.prismaService.diagramInvite.findUnique({
        where: { id },
      });
    if (!foundDiagramInvite) {
      throw new NotFoundException('Error fetching diagram invite');
    }
    return foundDiagramInvite;
  }

  async update(
    id: string,
    updateDiagramInviteDto: UpdateDiagramInviteDto,
  ): Promise<DiagramInvite> {
    const updatedDiagramInvite = await this.prismaService.diagramInvite.update({
      where: { id },
      data: updateDiagramInviteDto,
    });
    if (!updatedDiagramInvite) {
      throw new NotFoundException('Error updating diagram invite');
    }
    return updatedDiagramInvite;
  }

  async remove(id: string): Promise<DiagramInvite> {
    const deletedDiagramInvite = await this.prismaService.diagramInvite.update({
      where: { id },
      data: { isActive: false },
    });
    if (!deletedDiagramInvite) {
      throw new NotFoundException('Error deleting diagram invite');
    }
    return deletedDiagramInvite;
  }
}
