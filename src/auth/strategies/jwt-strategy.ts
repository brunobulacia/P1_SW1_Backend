import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

//COPIE Y PEGUE DE LA DOCUMENTACION OFICIAL DE NESTJS PASSPORT (NO TOCAR JEJE)
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  //TRAEMOS EL SERVICIO DE PRISMA PARA PODER HACER CONSULTAS A LA BASE DE DATOS
  constructor(private readonly prisma: PrismaService) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  //ACA EN EL PAYLOAD VAN LOS DATOS QUE VAMOS A ENVIAR AL USUARIO UNA VEZ VALIDEMOS SU JWT DEL PERRITOOOUU
  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true },
    });
    if (!user) return null;
    return user;
  }
}
