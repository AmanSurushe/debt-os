import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Repository } from '../../repo/entities/repository.entity';
import { DebtItem } from '../../debt/entities/debt-item.entity';
import { FileSnapshot } from './file-snapshot.entity';

export type ScanStatus = 'pending' | 'ingesting' | 'analyzing' | 'complete' | 'failed';
export type ScanTrigger = 'manual' | 'webhook' | 'schedule';

export interface ScanStats {
  filesAnalyzed: number;
  debtItemsFound: number;
  totalTokensUsed: number;
  totalCost: number;
  durationMs: number;
}

@Entity('scans')
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => Repository, (repo) => repo.scans)
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({ name: 'commit_sha' })
  commitSha: string;

  @Column()
  branch: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'ingesting', 'analyzing', 'complete', 'failed'],
    default: 'pending',
  })
  status: ScanStatus;

  @Column({
    name: 'triggered_by',
    type: 'enum',
    enum: ['manual', 'webhook', 'schedule'],
  })
  triggeredBy: ScanTrigger;

  @Column({ name: 'triggered_by_id', type: 'varchar', nullable: true })
  triggeredById: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', default: {} })
  stats: ScanStats;

  @OneToMany(() => DebtItem, (debtItem) => debtItem.scan)
  debtItems: DebtItem[];

  @OneToMany(() => FileSnapshot, (fileSnapshot) => fileSnapshot.scan)
  fileSnapshots: FileSnapshot[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
