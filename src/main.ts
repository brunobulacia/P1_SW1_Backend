import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
<<<<<<< HEAD
    origin: 'http://localhost:3000', // URL específica de tu frontend
    credentials: true, // Permite cookies/credenciales
    allowedHeaders: ['Content-Type', 'Authorization'],
=======
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
>>>>>>> d31240d (Antes del desarollo colaborativo)
  });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
