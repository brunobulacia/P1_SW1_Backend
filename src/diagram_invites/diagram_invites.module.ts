import { Module } from '@nestjs/common';
import { DiagramInvitesService } from './diagram_invites.service';
import { DiagramInvitesController } from './diagram_invites.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DiagramInvitesController],
  providers: [DiagramInvitesService],
})
export class DiagramInvitesModule {}
