'use client';

import {
  ArrowLeft,
  AlertTriangle,
  FileCode,
  GitCommit,
  User,
  Calendar,
  Lightbulb,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, formatRelativeTime } from '@/lib/utils';

// Mock data
const debtItem = {
  id: '1',
  title: 'High cyclomatic complexity in AuthController.handleLogin',
  debtType: 'COMPLEXITY',
  severity: 'high',
  confidence: 0.92,
  filePath: 'src/controllers/AuthController.ts',
  startLine: 45,
  endLine: 128,
  status: 'open',
  repository: {
    id: '1',
    fullName: 'acme/frontend-app',
  },
  estimatedEffort: 'medium',
  description: `The \`handleLogin\` method has a cyclomatic complexity of 18, which exceeds the recommended threshold of 10. This makes the code difficult to test, maintain, and understand.

High complexity often indicates that a function is doing too much. Consider breaking this method into smaller, focused functions.`,
  evidence: [
    {
      type: 'code',
      content: `async handleLogin(req: Request, res: Response) {
  const { email, password, rememberMe, mfaCode } = req.body;

  // Multiple nested conditions contribute to complexity
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await this.userService.findByEmail(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.isLocked) {
    if (Date.now() - user.lockedAt > 30 * 60 * 1000) {
      await this.userService.unlock(user.id);
    } else {
      return res.status(423).json({ error: 'Account locked' });
    }
  }

  // ... more complex branching logic
}`,
      location: {
        file: 'src/controllers/AuthController.ts',
        startLine: 45,
        endLine: 75,
      },
    },
  ],
  introducedInCommit: 'a1b2c3d4e5f6',
  introducedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  introducedBy: 'john.doe@acme.com',
  suggestedFix: `Consider refactoring the \`handleLogin\` method using the following approach:

1. **Extract validation logic** into a separate \`validateLoginInput\` method
2. **Extract user verification** into \`verifyUserCredentials\`
3. **Extract MFA handling** into \`handleMfaChallenge\`
4. **Use early returns** to reduce nesting depth
5. **Consider using a state machine** for the authentication flow

Example refactored structure:
\`\`\`typescript
async handleLogin(req: Request, res: Response) {
  const validationResult = this.validateLoginInput(req.body);
  if (!validationResult.valid) {
    return res.status(400).json(validationResult.error);
  }

  const authResult = await this.authenticateUser(validationResult.data);
  return res.status(authResult.status).json(authResult.body);
}
\`\`\``,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity as 'critical' | 'high' | 'medium' | 'low' | 'info';
  return <Badge variant={variant}>{severity}</Badge>;
}

export default function DebtDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/debt"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debt items
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity={debtItem.severity} />
              <Badge variant="outline">
                {debtItem.debtType.replace(/_/g, ' ')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {Math.round(debtItem.confidence * 100)}% confidence
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold">{debtItem.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <Link
                href={`/repos/${debtItem.repository.id}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <FileCode className="h-4 w-4" />
                {debtItem.repository.fullName}
              </Link>
              <span className="font-mono text-xs">
                {debtItem.filePath}:{debtItem.startLine}-{debtItem.endLine}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Select defaultValue={debtItem.status}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="wont_fix">Won't Fix</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <a
                href={`https://github.com/${debtItem.repository.fullName}/blob/main/${debtItem.filePath}#L${debtItem.startLine}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">View in GitHub</span>
                <span className="sm:hidden">GitHub</span>
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Issue Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">
                {debtItem.description}
              </p>
            </CardContent>
          </Card>

          {/* Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-blue-500" />
                Code Evidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debtItem.evidence.map((evidence, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono">
                      {evidence.location?.file}:{evidence.location?.startLine}-
                      {evidence.location?.endLine}
                    </span>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-secondary p-4 font-mono text-sm">
                    <code>{evidence.content}</code>
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Suggested Fix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Suggested Fix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-muted-foreground text-sm">
                  {debtItem.suggestedFix}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Effort</span>
                <Badge variant="outline">{debtItem.estimatedEffort}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className="border-blue-800 bg-blue-950 text-blue-400">
                  {debtItem.status}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Found</span>
                <span className="text-sm">
                  {formatRelativeTime(debtItem.createdAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Git Context */}
          <Card>
            <CardHeader>
              <CardTitle>Git Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitCommit className="h-4 w-4" />
                  Introduced in
                </div>
                <code className="block text-sm font-mono">
                  {debtItem.introducedInCommit}
                </code>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Author
                </div>
                <span className="text-sm">{debtItem.introducedBy}</span>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Date
                </div>
                <span className="text-sm">
                  {formatDate(debtItem.introducedAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Is this finding accurate?
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Valid
                </Button>
                <Button variant="outline" className="flex-1">
                  <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  Invalid
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
