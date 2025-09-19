import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserDto } from '../users/dto/create-user.dto';
import type { loginDto } from './dto/login.dto';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const hashedPassword = bcrypt.hashSync(createUserDto.password, 10);
      const user = await this.prismaService.user.create({
        data: { ...createUserDto, password: hashedPassword },
      });
      return user;
    } catch (error) {
      throw new Error('Error creating user');
    }
  }

  async login(
    loginDto: loginDto,
  ): Promise<{ access_token: string; user: User } | null> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { email: loginDto.email },
      });
      if (user && bcrypt.compareSync(loginDto.password, user.password)) {
        const payload = { email: user.email, sub: user.id };
        const access_token = this.jwtService.sign(payload);
        return { access_token, user };
      }
      return null;
    } catch (error) {
      throw new NotFoundException('Error logging in');
    }
  }
}
