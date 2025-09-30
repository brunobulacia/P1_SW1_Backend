// src/diagram_socket/diagram-socket.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { DiagramSocketService } from './diagram-socket.service';
import { DiagramInvitesService } from 'src/diagram_invites/diagram_invites.service';
import { JwtService } from '@nestjs/jwt';
import { CreateDiagramInviteDto } from 'src/diagram_invites/dto/create-diagram_invite.dto';
import { DiagramsService } from 'src/diagrams/diagrams.service';

// importar GoogleGenAI
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://54.207.207.246:3000'], // ajusta si tu frontend corre en otra URL
    credentials: true,
  },
  namespace: '/', // default
})
export class DiagramSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() wss: Server;

  constructor(
    private readonly diagramSocketService: DiagramSocketService,
    private readonly diagramInvitesService: DiagramInvitesService,
    private readonly diagramService: DiagramsService,
    private readonly token: JwtService,
  ) {}

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

  @SubscribeMessage('join-diagram')
  handleJoinDiagram(
    @MessageBody() data: { diagramId: string | number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `diagram:${data.diagramId}`;
    client.join(room);
    client.emit('joined-diagram', { diagramId: data.diagramId });
  }

  @SubscribeMessage('leave-diagram')
  handleLeaveDiagram(
    @MessageBody() data: { diagramId: string | number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `diagram:${data.diagramId}`;
    client.leave(room);
  }

  @SubscribeMessage('generate-invite')
  async handleGenerateInvite(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const token = this.token.sign(data);
    data.token = token;
    data as CreateDiagramInviteDto;
    const invite = await this.diagramInvitesService.create(data);
    client.emit('invite-created', invite);
  }

  /**
   * Espera: { id, model: { nodes, edges, ... } }
   * Filtra el payload para no pasar campos desconocidos a Prisma (p.ej., sourceId).
   */
  @SubscribeMessage('update-diagram')
  async handleUpdateDiagram(
    @MessageBody()
    data: {
      id: string;
      model: any; // { nodes, edges, metadata? }
      // NO sourceId
    },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { id, model } = data || ({} as any);
    if (!id || !model) {
      client.emit('diagram-updated:ack', {
        id,
        ok: false,
        reason: 'invalid-payload',
      });
      return;
    }

    // 👉 Solo pasamos campos válidos al service/Prisma
    const updatedDiagram = await this.diagramService.update(id, {
      model,
    } as any);

    const room = `diagram:${id}`;

    // Broadcast a todos EXCEPTO el emisor, dentro de la misma room
    client.to(room).emit('diagram-updated', {
      id: updatedDiagram.id,
      model: updatedDiagram.model,
      // sin sourceId
    });

    // ACK al emisor (sin el modelo completo para ahorrar ancho de banda)
    client.emit('diagram-updated:ack', { id, ok: true });
  }

  @SubscribeMessage('generate-agent')
  async handleGenerateAgent(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: data.prompt,
    });
    console.log(response.text);
    client.emit('agent-generated', { text: response.text });
  }
}
