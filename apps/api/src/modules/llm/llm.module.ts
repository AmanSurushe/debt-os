import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
