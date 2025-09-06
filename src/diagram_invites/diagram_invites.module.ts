import { Module } from '@nestjs/common';
import { DiagramInvitesService } from './diagram_invites.service';
import { DiagramInvitesController } from './diagram_invites.controller';

@Module({
  controllers: [DiagramInvitesController],
  providers: [DiagramInvitesService],
})
export class DiagramInvitesModule {}
