import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Repository } from '../../repo/entities/repository.entity';
import { Scan } from '../../scan/entities/scan.entity';

export enum DebtType {
  // Code-level
  CODE_SMELL = 'code_smell',
  COMPLEXITY = 'complexity',
  DUPLICATION = 'duplication',
  DEAD_CODE = 'dead_code',

  // Architectural
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  LAYER_VIOLATION = 'layer_violation',
  GOD_CLASS = 'god_class',
  FEATURE_ENVY = 'feature_envy',

  // Dependency
  OUTDATED_DEPENDENCY = 'outdated_dependency',
  VULNERABLE_DEPENDENCY = 'vulnerable_dependency',
  MISSING_LOCK_FILE = 'missing_lock_file',

  // Testing
  LOW_COVERAGE = 'low_coverage',
  MISSING_TESTS = 'missing_tests',
  FLAKY_TESTS = 'flaky_tests',

  // Documentation
  MISSING_DOCS = 'missing_docs',
  OUTDATED_DOCS = 'outdated_docs',

  // Infrastructure
  HARDCODED_CONFIG = 'hardcoded_config',
  SECURITY_ISSUE = 'security_issue',
}

export type DebtSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type DebtStatus = 'open' | 'acknowledged' | 'planned' | 'in_progress' | 'resolved' | 'wont_fix';
export type EffortEstimate = 'trivial' | 'small' | 'medium' | 'large' | 'xlarge';

@Entity('debt_items')
@Index(['repositoryId', 'fingerprint'])
@Index(['repositoryId', 'status'])
export class DebtItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scan_id' })
  scanId: string;

  @ManyToOne(() => Scan, (scan) => scan.debtItems)
  @JoinColumn({ name: 'scan_id' })
  scan: Scan;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => Repository, (repo) => repo.debtItems)
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  // Location
  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'start_line', type: 'int', nullable: true })
  startLine: number | null;

  @Column({ name: 'end_line', type: 'int', nullable: true })
  endLine: number | null;

  // Classification
  @Column({ name: 'debt_type', type: 'enum', enum: DebtType })
  debtType: DebtType;

  @Column({
    type: 'enum',
    enum: ['critical', 'high', 'medium', 'low', 'info'],
  })
  severity: DebtSeverity;

  @Column({ type: 'float' })
  confidence: number;

  // Description
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  evidence: string[];

  // Context (from git history)
  @Column({ name: 'introduced_in_commit', type: 'varchar', nullable: true })
  introducedInCommit: string | null;

  @Column({ name: 'introduced_at', type: 'timestamptz', nullable: true })
  introducedAt: Date | null;

  @Column({ name: 'introduced_by', type: 'varchar', nullable: true })
  introducedBy: string | null;

  // Remediation
  @Column({ name: 'suggested_fix', type: 'text', nullable: true })
  suggestedFix: string | null;

  @Column({
    name: 'estimated_effort',
    type: 'enum',
    enum: ['trivial', 'small', 'medium', 'large', 'xlarge'],
    nullable: true,
  })
  estimatedEffort: EffortEstimate | null;

  // Tracking
  @Column({
    type: 'enum',
    enum: ['open', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix'],
    default: 'open',
  })
  status: DebtStatus;

  @Column()
  @Index()
  fingerprint: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
