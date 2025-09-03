import { User } from '@prisma/client';

export type loginDto = Omit<User, 'id' | 'username'>;
