export interface GitConfig {
  basePath: string;
}

export interface CloneOptions {
  url: string;
  branch?: string;
  depth?: number;
  token?: string;
}

export interface PullOptions {
  branch?: string;
  token?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: Date;
}

export interface FileInfo {
  path: string;
  type: 'file' | 'directory';
}

export interface BlameInfo {
  lineNumber: number;
  commitSha: string;
  authorName: string;
  authorEmail: string;
  date: Date;
  content: string;
}
