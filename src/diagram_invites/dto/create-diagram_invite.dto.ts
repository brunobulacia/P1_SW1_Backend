import { DiagramInvite } from '@prisma/client';

export type CreateDiagramInviteDto = Omit<
  DiagramInvite,
  'id' | 'createdAt' | 'updatedAt' | 'isActive'
>;
