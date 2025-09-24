import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { DiagramSocketService } from './diagram-socket.service';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class DiagramSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly diagramSocketService: DiagramSocketService) {}

  handleConnection(client: Socket) {
    this.diagramSocketService.addClient(client);
    console.log({ conexiones: this.diagramSocketService.getClientCount() });
  }

  handleDisconnect(client: Socket) {
    this.diagramSocketService.removeClient(client);
    console.log('Cliente desconectado:', client.id);
  }
}
