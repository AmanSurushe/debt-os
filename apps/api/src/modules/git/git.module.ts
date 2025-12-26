import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GitService } from '@debt-os/git';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GitService,
      useFactory: (configService: ConfigService) => {
        const basePath = configService.get<string>('REPO_STORAGE_PATH', '/tmp/debt-os/repos');
        return new GitService({ basePath });
      },
      inject: [ConfigService],
    },
  ],
  exports: [GitService],
})
export class GitModule {}
