import { Diagram } from '@prisma/client';

export type CreateDiagramDto = Omit<
  Diagram,
  'id' | 'createdAt' | 'updatedAt' | 'isActive'
> & {
  model: JSON;
};
