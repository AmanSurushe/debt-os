import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async findOrCreateUser(
    provider: 'github' | 'gitlab',
    profile: OAuthProfile,
  ): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { provider, providerId: profile.id },
    });

    if (user) {
      // Update tokens
      user.accessToken = profile.accessToken;
      user.refreshToken = profile.refreshToken || user.refreshToken;
      user.name = profile.name;
      user.avatarUrl = profile.avatarUrl || user.avatarUrl;
      await this.userRepository.save(user);
    } else {
      // Create new user
      user = this.userRepository.create({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        provider,
        providerId: profile.id,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      });
      await this.userRepository.save(user);
    }

    return user;
  }

  async generateToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    return this.jwtService.sign(payload);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify(token);
      return this.findById(payload.sub);
    } catch {
      return null;
    }
  }
}
