import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from './entities/api-key.entity';
import { User } from './entities/user.entity';

interface CreateApiKeyResult {
  apiKey: ApiKey;
  rawKey: string;
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    name: string,
    scopes: string[] = ['read'],
    expiresAt?: Date,
  ): Promise<CreateApiKeyResult> {
    // Generate a random key
    const rawKey = `dos_${uuidv4().replace(/-/g, '')}`;
    const prefix = rawKey.substring(0, 12);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const apiKey = this.apiKeyRepository.create({
      userId,
      name,
      keyHash,
      prefix,
      scopes,
      expiresAt,
    });

    await this.apiKeyRepository.save(apiKey);

    return { apiKey, rawKey };
  }

  async validateKey(
    rawKey: string,
  ): Promise<{ apiKey: ApiKey; user: User } | null> {
    const prefix = rawKey.substring(0, 12);

    const apiKey = await this.apiKeyRepository.findOne({
      where: { prefix },
      relations: ['user'],
    });

    if (!apiKey) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Verify hash
    const isValid = await bcrypt.compare(rawKey, apiKey.keyHash);
    if (!isValid) {
      return null;
    }

    // Update last used
    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepository.save(apiKey);

    return { apiKey, user: apiKey.user };
  }

  async findByUser(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string, userId: string): Promise<boolean> {
    const result = await this.apiKeyRepository.delete({ id, userId });
    return (result.affected || 0) > 0;
  }
}
