import { DiagramMember } from '@prisma/client';
export type CreateDiagramMemberDto = Omit<
  DiagramMember,
  'id' | 'joinedAt' | 'createdAt' | 'updatedAt' | 'isActive'
>;
