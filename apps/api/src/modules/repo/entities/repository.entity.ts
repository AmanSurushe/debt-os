import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Scan } from '../../scan/entities/scan.entity';
import { DebtItem } from '../../debt/entities/debt-item.entity';

export interface RepositorySettings {
  autoScan: boolean;
  scanOnPush: boolean;
  scanOnPr: boolean;
  excludePaths: string[];
  includePaths: string[];
}

@Entity('repositories')
export class Repository {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_id' })
  externalId: string;

  @Column({ type: 'enum', enum: ['github', 'gitlab'] })
  provider: 'github' | 'gitlab';

  @Column({ name: 'owner_name' })
  ownerName: string;

  @Column()
  name: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'default_branch', default: 'main' })
  defaultBranch: string;

  @Column({ name: 'clone_url' })
  cloneUrl: string;

  @Column({ name: 'webhook_id', type: 'varchar', nullable: true })
  webhookId: string | null;

  @Column({ name: 'webhook_secret', type: 'varchar', nullable: true })
  webhookSecret: string | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'jsonb', default: {} })
  settings: RepositorySettings;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.repositories)
  @JoinColumn({ name: 'user_id' })
  owner: User;

  @OneToMany(() => Scan, (scan) => scan.repository)
  scans: Scan[];

  @OneToMany(() => DebtItem, (debtItem) => debtItem.repository)
  debtItems: DebtItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
