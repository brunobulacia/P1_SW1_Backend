import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Diagram } from '@prisma/client';

@Injectable()
export class DiagramsService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(createDiagramDto: CreateDiagramDto): Promise<Diagram> {
    const createdDiagram = await this.prismaService.diagram.create({
      data: createDiagramDto,
    });

    if (!createdDiagram) {
      throw new NotAcceptableException('Error creating diagram');
    }

    return createdDiagram;
  }

  async findAll(): Promise<Diagram[]> {
    const foundDiagrams = await this.prismaService.diagram.findMany();
    if (!foundDiagrams) {
      throw new NotFoundException('Error fetching diagrams');
    }
    return foundDiagrams;
  }

  async findOne(id: string): Promise<Diagram> {
    const foundDiagram = await this.prismaService.diagram.findUnique({
      where: { id },
    });

    if (!foundDiagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }

    return foundDiagram;
  }

  async update(
    id: string,
    updateDiagramDto: UpdateDiagramDto,
  ): Promise<Diagram> {
    const updatedDiagram = await this.prismaService.diagram.update({
      where: { id },
      data: updateDiagramDto,
    });

    if (!updatedDiagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }

    return updatedDiagram;
  }

  async remove(id: string): Promise<Diagram> {
    const deletedDiagram = await this.prismaService.diagram.update({
      where: { id },
      data: { isActive: false },
    });

    if (!deletedDiagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }

    return deletedDiagram;
  }

  //Individual functions
  async findByOwner(ownerId: string): Promise<Diagram[]> {
    const foundDiagrams = await this.prismaService.diagram.findMany({
      where: { ownerId, isActive: true },
    });

    if (!foundDiagrams) {
      throw new NotFoundException(`No diagrams found for owner ${ownerId}`);
    }

    return foundDiagrams;
  }
}
