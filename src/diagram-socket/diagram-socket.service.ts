import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

interface ConnectedClients {
  [clientId: string]: Socket;
}

@Injectable()
export class DiagramSocketService {
  private connectedClients: ConnectedClients = {};

  addClient(client: Socket) {
    this.connectedClients[client.id] = client;
  }

  removeClient(client: Socket) {
    delete this.connectedClients[client.id];
  }

  getClients() {
    return Object.values(this.connectedClients);
  }

  getClientCount() {
    return Object.keys(this.connectedClients).length;
  }
}
