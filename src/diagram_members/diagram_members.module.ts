import { Module } from '@nestjs/common';
import { DiagramMembersService } from './diagram_members.service';
import { DiagramMembersController } from './diagram_members.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DiagramMembersController],
  providers: [DiagramMembersService],
})
export class DiagramMembersModule {}
