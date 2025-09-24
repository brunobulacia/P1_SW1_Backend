import { Module } from '@nestjs/common';
import { DiagramSocketService } from './diagram-socket.service';
import { DiagramSocketGateway } from './diagram-socket.gateway';

@Module({
  providers: [DiagramSocketGateway, DiagramSocketService],
})
export class DiagramSocketModule {}
