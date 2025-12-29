'use client';

import {
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Mock data
const stats = [
  {
    title: 'Total Repositories',
    value: '12',
    change: '+2',
    trend: 'up',
    icon: GitBranch,
  },
  {
    title: 'Debt Items',
    value: '247',
    change: '-18',
    trend: 'down',
    icon: AlertTriangle,
  },
  {
    title: 'Resolved This Week',
    value: '34',
    change: '+12',
    trend: 'up',
    icon: CheckCircle,
  },
  {
    title: 'Avg Resolution Time',
    value: '2.4d',
    change: '-0.5d',
    trend: 'down',
    icon: Clock,
  },
];

const severityBreakdown = [
  { label: 'Critical', count: 8, color: 'bg-red-500', percentage: 3 },
  { label: 'High', count: 42, color: 'bg-orange-500', percentage: 17 },
  { label: 'Medium', count: 89, color: 'bg-yellow-500', percentage: 36 },
  { label: 'Low', count: 108, color: 'bg-blue-500', percentage: 44 },
];

const recentScans = [
  {
    repo: 'frontend-app',
    branch: 'main',
    status: 'complete',
    itemsFound: 23,
    time: '2 hours ago',
  },
  {
    repo: 'api-service',
    branch: 'develop',
    status: 'analyzing',
    itemsFound: 0,
    time: 'Just now',
  },
  {
    repo: 'shared-lib',
    branch: 'main',
    status: 'complete',
    itemsFound: 5,
    time: '1 day ago',
  },
];

const quickWins = [
  {
    title: 'Remove unused imports in UserService.ts',
    effort: 'trivial',
    severity: 'low',
    file: 'src/services/UserService.ts',
  },
  {
    title: 'Fix missing null check in API handler',
    effort: 'small',
    severity: 'medium',
    file: 'src/api/handlers/auth.ts',
  },
  {
    title: 'Update deprecated axios method',
    effort: 'trivial',
    severity: 'low',
    file: 'src/lib/http.ts',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center gap-1 text-xs">
                {stat.trend === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-green-500" />
                )}
                <span className="text-green-500">{stat.change}</span>
                <span className="text-muted-foreground">vs last week</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Severity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Severity Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {severityBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-medium">{item.count}</span>
                </div>
                <Progress value={item.percentage} className="h-1.5" />
              </div>
            ))}
            <Link href="/debt">
              <Button variant="ghost" className="w-full mt-4" size="sm">
                View all debt items
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Scans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-500" />
              Recent Scans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentScans.map((scan, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{scan.repo}</span>
                    <Badge variant="outline" className="text-xs">
                      {scan.branch}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{scan.time}</p>
                </div>
                <div className="text-right">
                  {scan.status === 'analyzing' ? (
                    <Badge variant="info" className="text-xs">
                      <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-current inline-block" />
                      Analyzing
                    </Badge>
                  ) : (
                    <span className="text-sm font-medium">
                      {scan.itemsFound} items
                    </span>
                  )}
                </div>
              </div>
            ))}
            <Link href="/repos">
              <Button variant="ghost" className="w-full mt-2" size="sm">
                View all repositories
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Quick Wins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Quick Wins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickWins.map((win, index) => (
              <div
                key={index}
                className="rounded-md border border-border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">
                      {win.title}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {win.file}
                    </p>
                  </div>
                  <Badge
                    variant={win.severity as 'low' | 'medium'}
                    className="shrink-0 text-xs"
                  >
                    {win.severity}
                  </Badge>
                </div>
              </div>
            ))}
            <Link href="/debt?effort=trivial,small">
              <Button variant="ghost" className="w-full mt-2" size="sm">
                View all quick wins
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* CTA Section */}
      <Card>
        <CardContent className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <h3 className="font-semibold">Ready to tackle your technical debt?</h3>
            <p className="text-sm text-muted-foreground">
              Connect a repository and start your first scan.
            </p>
          </div>
          <Link href="/repos">
            <Button>
              <GitBranch className="mr-2 h-4 w-4" />
              Connect Repository
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
