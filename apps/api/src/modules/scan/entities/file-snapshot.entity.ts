import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('file_snapshots')
@Index(['scanId', 'filePath'], { unique: true })
export class FileSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scan_id' })
  scanId: string;

  @ManyToOne('Scan', 'fileSnapshots', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scan_id' })
  scan: any;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'content_hash' })
  contentHash: string;

  @Column({ type: 'varchar', nullable: true })
  language: string | null;

  @Column({ name: 'line_count', type: 'int' })
  lineCount: number;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ name: 'analyzed_at', type: 'timestamptz', nullable: true })
  analyzedAt: Date | null;

  @Column({ name: 'embedding_status', type: 'varchar', default: 'pending' })
  embeddingStatus: 'pending' | 'processing' | 'complete' | 'failed';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
