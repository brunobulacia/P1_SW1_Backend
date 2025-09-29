//postman-generator.service.ts
import { Injectable } from '@nestjs/common';

interface ModelNodeAttr {
  id: string;
  name: string;
  type: string;
  visibility?: string;
}

interface ModelNode {
  id: string;
  data: {
    label: string;
    methods?: any[];
    attributes?: ModelNodeAttr[];
  };
}

interface ModelEdge {
  data?: {
    type?: string;
    label?: string;
    sourceCardinality?: string;
    targetCardinality?: string;
    associationClass?: string;
  };
  type?: string;
  source: string;
  target: string;
}

interface DiagramModel {
  nodes: ModelNode[];
  edges: ModelEdge[];
  metadata?: any;
}

@Injectable()
export class PostmanGeneratorService {
  generateCollectionsFromModel(model: DiagramModel): any {
    const nodes = model.nodes || [];
    const items: any[] = [];

    // Mapa de nodos para obtener nombres de clases
    const nodeIdToClass: Record<string, string> = {};
    const attributesMap: Record<string, ModelNodeAttr[]> = {};

    for (const node of nodes) {
      const className = this.sanitizeClassName(node.data.label);
      nodeIdToClass[node.id] = className;
      attributesMap[className] = node.data.attributes || [];
    }

    // Crear items para cada clase
    for (const node of nodes) {
      const className = nodeIdToClass[node.id];
      const attributes = attributesMap[className] || [];
      const lowerClassName =
        className.charAt(0).toLowerCase() + className.slice(1);

      const classItems = this.createItemsForClass(
        className,
        lowerClassName,
        attributes,
      );
      items.push(...classItems);
    }

    return {
      info: {
        name: 'Generated API Collections',
        description:
          'Collections generadas automáticamente desde el diagrama UML',
        schema:
          'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: items,
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:8080',
          type: 'string',
        },
      ],
    };
  }

  private createItemsForClass(
    className: string,
    lowerClassName: string,
    attributes: ModelNodeAttr[],
  ): any[] {
    const baseUrl = '{{baseUrl}}';
    const endpoint = `/api/${lowerClassName}`;

    // Generar ejemplo de body para POST/PUT
    const exampleBody = this.generateExampleBody(className, attributes);

    return [
      // GET all
      {
        name: `Get All ${className}s`,
        request: {
          method: 'GET',
          header: [
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          url: {
            raw: `${baseUrl}${endpoint}`,
            host: ['{{baseUrl}}'],
            path: endpoint.split('/').filter((p) => p),
          },
          description: `Obtener todos los registros de ${className}`,
        },
        response: [],
      },

      // GET by ID
      {
        name: `Get ${className} by ID`,
        request: {
          method: 'GET',
          header: [
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          url: {
            raw: `${baseUrl}${endpoint}/{{${lowerClassName}Id}}`,
            host: ['{{baseUrl}}'],
            path: [
              ...endpoint.split('/').filter((p) => p),
              `{{${lowerClassName}Id}}`,
            ],
          },
          description: `Obtener un ${className} específico por ID`,
        },
        response: [],
      },

      // POST
      {
        name: `Create ${className}`,
        request: {
          method: 'POST',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(exampleBody, null, 2),
          },
          url: {
            raw: `${baseUrl}${endpoint}`,
            host: ['{{baseUrl}}'],
            path: endpoint.split('/').filter((p) => p),
          },
          description: `Crear un nuevo ${className}`,
        },
        response: [],
      },

      // PUT
      {
        name: `Update ${className}`,
        request: {
          method: 'PUT',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(exampleBody, null, 2),
          },
          url: {
            raw: `${baseUrl}${endpoint}/{{${lowerClassName}Id}}`,
            host: ['{{baseUrl}}'],
            path: [
              ...endpoint.split('/').filter((p) => p),
              `{{${lowerClassName}Id}}`,
            ],
          },
          description: `Actualizar un ${className} existente`,
        },
        response: [],
      },

      // DELETE
      {
        name: `Delete ${className}`,
        request: {
          method: 'DELETE',
          header: [
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          url: {
            raw: `${baseUrl}${endpoint}/{{${lowerClassName}Id}}`,
            host: ['{{baseUrl}}'],
            path: [
              ...endpoint.split('/').filter((p) => p),
              `{{${lowerClassName}Id}}`,
            ],
          },
          description: `Eliminar un ${className} por ID`,
        },
        response: [],
      },
    ];
  }

  private generateExampleBody(
    className: string,
    attributes: ModelNodeAttr[],
  ): any {
    const body: any = {};

    for (const attr of attributes) {
      if (attr.name === 'id') {
        // Para el ID, usar un valor de ejemplo
        body[attr.name] = this.getExampleValue(attr.type, true);
      } else {
        body[attr.name] = this.getExampleValue(attr.type, false);
      }
    }

    return body;
  }

  private getExampleValue(type: string, isId: boolean = false): any {
    const lowerType = (type || '').toLowerCase();

    if (isId) {
      return 1; // ID de ejemplo
    }

    switch (lowerType) {
      case 'int':
      case 'integer':
        return 123;
      case 'long':
        return 123456789;
      case 'string':
      default:
        return `Example${type || 'String'}`;
    }
  }

  private sanitizeClassName(label: string): string {
    return label
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^(.)/, (c) => c.toUpperCase());
  }
}
