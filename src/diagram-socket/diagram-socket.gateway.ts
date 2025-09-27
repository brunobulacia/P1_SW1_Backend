import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { DiagramSocketService } from './diagram-socket.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class DiagramSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() wss: Server;
  constructor(private readonly diagramSocketService: DiagramSocketService) {}

  handleConnection(client: Socket) {
    this.diagramSocketService.addClient(client);
    this.wss.emit('message', {
      conexiones: this.diagramSocketService.getClientCount(),
    });
  }

  handleDisconnect(client: Socket) {
    this.diagramSocketService.removeClient(client);
    this.wss.emit('message', {
      conexiones: this.diagramSocketService.getClientCount(),
    });
  }

  @SubscribeMessage('hello')
  handleHelloFromClient(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log('Payload recibido en hello:', data);
    // Puedes responder si quieres:
    // client.emit('helloResponse', 'Hola desde el backend');
  }
}
