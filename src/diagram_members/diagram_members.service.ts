import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDiagramMemberDto } from './dto/create-diagram_member.dto';
import { UpdateDiagramMemberDto } from './dto/update-diagram_member.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DiagramMember } from '@prisma/client';

@Injectable()
export class DiagramMembersService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(
    createDiagramMemberDto: CreateDiagramMemberDto,
  ): Promise<DiagramMember> {
    const createdDiagramMember = await this.prismaService.diagramMember.create({
      data: createDiagramMemberDto,
    });

    if (!createdDiagramMember) {
      throw new NotAcceptableException('Error creating diagram member');
    }

    return createdDiagramMember;
  }

  async findAll(): Promise<DiagramMember[]> {
    const foundDiagramMembers =
      await this.prismaService.diagramMember.findMany();
    if (!foundDiagramMembers) {
      throw new NotFoundException('Error fetching diagram members');
    }
    return foundDiagramMembers;
  }

  async findOne(id: string): Promise<DiagramMember> {
    const foundDiagramMember =
      await this.prismaService.diagramMember.findUnique({
        where: { id },
      });
    if (!foundDiagramMember) {
      throw new NotFoundException(`Diagram member with ID ${id} not found`);
    }
    return foundDiagramMember;
  }

  async update(id: string, updateDiagramMemberDto: UpdateDiagramMemberDto) {
    const updatedDiagramMember = await this.prismaService.diagramMember.update({
      where: { id },
      data: updateDiagramMemberDto,
    });
    if (!updatedDiagramMember) {
      throw new NotFoundException(`Diagram member with ID ${id} not found`);
    }
    return updatedDiagramMember;
  }

  async remove(id: string) {
    const deletedDiagramMember = await this.prismaService.diagramMember.update({
      where: { id },
      data: { isActive: false },
    });
    if (!deletedDiagramMember) {
      throw new NotFoundException(`Diagram member with ID ${id} not found`);
    }
    return deletedDiagramMember;
  }
}
