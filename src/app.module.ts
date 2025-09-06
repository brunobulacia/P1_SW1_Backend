import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { DiagramsModule } from './diagrams/diagrams.module';
import { DiagramMembersModule } from './diagram_members/diagram_members.module';
import { DiagramInvitesModule } from './diagram_invites/diagram_invites.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    DiagramsModule,
    DiagramMembersModule,
    DiagramInvitesModule,
  ],
  controllers: [],
  providers: [
    {
      //PARA PONER EL GUARD DE JWT EN TODOS LOS ENDPOINTS PERRITOUUUU
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
