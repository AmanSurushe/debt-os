import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('file_embeddings')
@Index(['fileSnapshotId', 'chunkIndex'], { unique: true })
export class FileEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_snapshot_id' })
  fileSnapshotId: string;

  @ManyToOne('FileSnapshot', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_snapshot_id' })
  fileSnapshot: any;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'start_line', type: 'int' })
  startLine: number;

  @Column({ name: 'end_line', type: 'int' })
  endLine: number;

  @Column({ name: 'token_count', type: 'int' })
  tokenCount: number;

  // pgvector column - stored as vector(1536) in PostgreSQL
  // We store as float8 array in TypeORM, migration will handle the vector type
  @Column({
    type: 'float8',
    array: true,
    name: 'embedding',
  })
  embedding: number[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
