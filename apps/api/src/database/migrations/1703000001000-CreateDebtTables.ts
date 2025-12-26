import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDebtTables1703000001000 implements MigrationInterface {
  name = 'CreateDebtTables1703000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create debt_findings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS debt_findings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        debt_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        evidence JSONB DEFAULT '[]',
        suggested_fix TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for debt_findings
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_findings_scan_id ON debt_findings(scan_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_findings_severity ON debt_findings(severity)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_findings_type ON debt_findings(debt_type)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_findings_file ON debt_findings(file_path)
    `);

    // Create remediation_plans table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS remediation_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        total_debt_items INTEGER NOT NULL DEFAULT 0,
        quick_wins JSONB DEFAULT '[]',
        strategic_work JSONB DEFAULT '[]',
        deferrable JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(scan_id)
      )
    `);

    // Create remediation_tasks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS remediation_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL REFERENCES remediation_plans(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        related_debt_ids JSONB DEFAULT '[]',
        estimated_effort VARCHAR(20) NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        dependencies JSONB DEFAULT '[]',
        suggested_approach TEXT,
        risks JSONB DEFAULT '[]',
        acceptance_criteria JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for remediation_tasks
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_remediation_tasks_plan ON remediation_tasks(plan_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_remediation_tasks_priority ON remediation_tasks(priority)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_remediation_tasks_status ON remediation_tasks(status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS remediation_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS remediation_plans`);
    await queryRunner.query(`DROP TABLE IF EXISTS debt_findings`);
  }
}
