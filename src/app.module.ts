import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [UsersModule, AuthModule],
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
