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

  @SubscribeMessage('generate-diagram')
  async handleGenerateDiagram(
    @MessageBody() data: { prompt: string; diagramId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const systemPrompt = `
Eres un experto en UML y diseño de diagramas de clases. Tu tarea es generar un diagrama UML en formato JSON basado en la descripción del usuario.

Formato esperado del JSON:
{
  "edges": [
    {
      "id": "edge-[sourceId]-[targetId]-[type]-[timestamp]",
      "data": {
        "type": "inheritance|association|aggregation|composition|realization|dependency",
        "label": "etiqueta de la relación",
        "sourceCardinality": "cardinalidad del origen (ej: 1..1, 1..*, 0..1)",
        "targetCardinality": "cardinalidad del destino"
      },
      "type": "inheritance|association|aggregation|composition|realization|dependency",
      "source": "node-[timestamp]",
      "target": "node-[timestamp]",
      "sourceHandle": "bottom|top|left|right|bottom-left|bottom-right|top-left|top-right",
      "targetHandle": "bottom|top|left|right|bottom-left|bottom-right|top-left|top-right"
    }
  ],
  "nodes": [
    {
      "id": "node-[timestamp]",
      "data": {
        "label": "NombreClase",
        "methods": [],
        "attributes": [
          {
            "id": "attr-[timestamp]",
            "name": "nombreAtributo",
            "type": "int|string|boolean|double|float|Date|etc",
            "visibility": "public|private|protected"
          }
        ],
        "isAssociationClass": false
      },
      "type": "textUpdater",
      "position": {
        "x": 100 + (index * 300),
        "y": 100 + (index * 200)
      }
    }
  ],
  "metadata": {
    "version": "1.0",
    "lastModified": "fecha actual"
  }
}

EJEMPLO de relación muchos-a-muchos (Usuario-Producto):
{
  "nodes": [
    {
      "id": "node-1234567890",
      "data": {
        "label": "Usuario",
        "methods": [],
        "attributes": [{"id": "attr-1", "name": "id", "type": "int", "visibility": "private"}, {"id": "attr-2", "name": "nombre", "type": "string", "visibility": "public"}],
        "isAssociationClass": false
      },
      "type": "textUpdater",
      "position": {"x": 100, "y": 100}
    },
    {
      "id": "node-1234567891", 
      "data": {
        "label": "Producto",
        "methods": [],
        "attributes": [{"id": "attr-3", "name": "id", "type": "int", "visibility": "private"}, {"id": "attr-4", "name": "nombre", "type": "string", "visibility": "public"}],
        "isAssociationClass": false
      },
      "type": "textUpdater",
      "position": {"x": 500, "y": 100}
    },
    {
      "id": "association-1234567892",
      "data": {
        "label": "Compra",
        "methods": [],
        "attributes": [{"id": "attr-5", "name": "cantidad", "type": "int", "visibility": "private"}, {"id": "attr-6", "name": "fecha", "type": "Date", "visibility": "private"}],
        "isAssociationClass": true
      },
      "type": "textUpdater",
      "position": {"x": 300, "y": 300}
    }
  ],
  "edges": [
    {
      "id": "edge-1234567890-1234567891-association-1234567893",
      "type": "association",
      "source": "node-1234567890",
      "target": "node-1234567891",
      "sourceHandle": "bottom",
      "targetHandle": "bottom",
      "data": {
        "type": "association",
        "sourceCardinality": "*",
        "targetCardinality": "*",
        "label": "compra",
        "associationClass": "association-1234567892"
      }
    }
  ]
}

Reglas importantes:
1. Genera IDs únicos usando timestamps
2. SIEMPRE incluye relaciones entre las clases (edges) - NO dejes el diagrama sin relaciones
3. Para herencia, usa type: "inheritance" y sourceHandle/targetHandle apropiados
4. Para asociaciones, usa type: "association" con cardinalidades apropiadas (ej: "1..1", "1..*", "0..1")
5. Posiciona las clases de manera que no se solapen
6. Usa tipos de datos apropiados (int, string, boolean, etc.)
7. Incluye SOLO atributos relevantes para cada clase, NO incluyas métodos
8. Siempre deja el array "methods" vacío: "methods": []
9. Si hay múltiples clases, crea relaciones lógicas entre ellas (asociaciones, herencia, etc.)
10. Responde ÚNICAMENTE con el JSON válido, SIN markdown, SIN explicaciones, SOLO el objeto JSON puro

Descripción del usuario: ${data.prompt}

IMPORTANTE: Si el usuario menciona múltiples clases, DEBES crear relaciones entre ellas. Ejemplos:
- Usuario y Producto: relación muchos-a-muchos con clase de asociación intermedia
- Si hay clases similares: crear herencia cuando sea apropiado
- Si hay jerarquías: crear herencia (ej: Vehiculo -> Auto, Camion)

Para relaciones muchos-a-muchos (como Usuario-Producto), crear:
1. Una clase de asociación intermedia (ej: "Compra" o "Pedido")
2. Una relación principal entre las clases con:
   - type: "association"
   - sourceCardinality: "*"
   - targetCardinality: "*"
   - associationClass: [id-de-la-clase-intermedia]
3. La clase intermedia debe tener isAssociationClass: true

OBLIGATORIO: Siempre incluye al menos una relación si hay más de una clase. NUNCA dejes el diagrama sin edges.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
      });

      // Limpiar la respuesta de cualquier markdown
      let cleanText = response.text || '{}';
      cleanText = cleanText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('🤖 Raw AI response:', response.text);
      console.log('🧹 Cleaned text:', cleanText);

      const diagramJson = JSON.parse(cleanText);
      console.log(
        '📊 Parsed diagram JSON:',
        JSON.stringify(diagramJson, null, 2),
      );

      // Actualizar el diagrama en la base de datos
      const updatedDiagram = await this.diagramService.update(data.diagramId, {
        model: diagramJson,
      });

      // Emitir la respuesta al cliente
      client.emit('diagram-generated', {
        success: true,
        diagram: diagramJson,
        message: 'Diagrama generado exitosamente',
      });

      // Broadcast a todos los clientes en la room del diagrama
      const room = `diagram:${data.diagramId}`;
      client.to(room).emit('diagram-updated', {
        id: updatedDiagram.id,
        model: updatedDiagram.model,
      });
    } catch (error) {
      console.error('Error generating diagram:', error);
      client.emit('diagram-generated', {
        success: false,
        error:
          'Error al generar el diagrama. Por favor, intenta con una descripción más específica.',
        message: error.message,
      });
    }
  }
}
