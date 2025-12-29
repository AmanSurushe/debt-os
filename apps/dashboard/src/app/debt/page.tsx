'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  FileCode,
  Clock,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime } from '@/lib/utils';

// Mock data
const debtItems = [
  {
    id: '1',
    title: 'High cyclomatic complexity in AuthController.handleLogin',
    debtType: 'COMPLEXITY',
    severity: 'high',
    confidence: 0.92,
    filePath: 'src/controllers/AuthController.ts',
    startLine: 45,
    status: 'open',
    repository: 'acme/frontend-app',
    estimatedEffort: 'medium',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    title: 'Circular dependency between UserService and AuthService',
    debtType: 'CIRCULAR_DEPENDENCY',
    severity: 'critical',
    confidence: 0.98,
    filePath: 'src/services/UserService.ts',
    startLine: 12,
    status: 'acknowledged',
    repository: 'acme/frontend-app',
    estimatedEffort: 'large',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    title: 'Duplicated validation logic in form handlers',
    debtType: 'DUPLICATION',
    severity: 'medium',
    confidence: 0.85,
    filePath: 'src/handlers/formHandlers.ts',
    startLine: 78,
    status: 'open',
    repository: 'acme/api-service',
    estimatedEffort: 'small',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    title: 'Missing null check for user object',
    debtType: 'CODE_SMELL',
    severity: 'high',
    confidence: 0.88,
    filePath: 'src/utils/permissions.ts',
    startLine: 23,
    status: 'planned',
    repository: 'acme/shared-lib',
    estimatedEffort: 'trivial',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    title: 'Outdated dependency: lodash@4.17.15 has known vulnerabilities',
    debtType: 'VULNERABLE_DEPENDENCY',
    severity: 'critical',
    confidence: 1.0,
    filePath: 'package.json',
    startLine: 42,
    status: 'open',
    repository: 'acme/frontend-app',
    estimatedEffort: 'small',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    title: 'God class: UserManager has 45 methods',
    debtType: 'GOD_CLASS',
    severity: 'high',
    confidence: 0.95,
    filePath: 'src/managers/UserManager.ts',
    startLine: 1,
    status: 'open',
    repository: 'acme/api-service',
    estimatedEffort: 'xlarge',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    title: 'Hardcoded API endpoint URL',
    debtType: 'HARDCODED_CONFIG',
    severity: 'low',
    confidence: 0.78,
    filePath: 'src/api/client.ts',
    startLine: 5,
    status: 'open',
    repository: 'acme/frontend-app',
    estimatedEffort: 'trivial',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8',
    title: 'Missing test coverage for payment module',
    debtType: 'MISSING_TESTS',
    severity: 'medium',
    confidence: 0.82,
    filePath: 'src/modules/payment/index.ts',
    startLine: 1,
    status: 'in_progress',
    repository: 'acme/api-service',
    estimatedEffort: 'large',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const severities = ['critical', 'high', 'medium', 'low', 'info'];
const statuses = ['open', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix'];
const debtTypes = [
  'CODE_SMELL',
  'COMPLEXITY',
  'DUPLICATION',
  'CIRCULAR_DEPENDENCY',
  'GOD_CLASS',
  'VULNERABLE_DEPENDENCY',
  'MISSING_TESTS',
  'HARDCODED_CONFIG',
];

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity as 'critical' | 'high' | 'medium' | 'low' | 'info';
  return <Badge variant={variant}>{severity}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'border-blue-800 bg-blue-950 text-blue-400',
    acknowledged: 'border-purple-800 bg-purple-950 text-purple-400',
    planned: 'border-indigo-800 bg-indigo-950 text-indigo-400',
    in_progress: 'border-yellow-800 bg-yellow-950 text-yellow-400',
    resolved: 'border-green-800 bg-green-950 text-green-400',
    wont_fix: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  };
  return (
    <Badge className={colors[status] || colors.open}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export default function DebtPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Filter items
  const filteredItems = debtItems.filter((item) => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.filePath.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedSeverities.length > 0 && !selectedSeverities.includes(item.severity)) {
      return false;
    }
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) {
      return false;
    }
    if (selectedTypes.length > 0 && !selectedTypes.includes(item.debtType)) {
      return false;
    }
    return true;
  });

  const toggleFilter = (
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Technical Debt</h2>
        <p className="text-sm text-muted-foreground">
          {filteredItems.length} items across all repositories
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title or file path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Severity Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Severity
                  {selectedSeverities.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedSeverities.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel>Filter by severity</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {severities.map((severity) => (
                  <DropdownMenuCheckboxItem
                    key={severity}
                    checked={selectedSeverities.includes(severity)}
                    onCheckedChange={() =>
                      toggleFilter(severity, selectedSeverities, setSelectedSeverities)
                    }
                  >
                    <SeverityBadge severity={severity} />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status
                  {selectedStatuses.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedStatuses.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {statuses.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() =>
                      toggleFilter(status, selectedStatuses, setSelectedStatuses)
                    }
                  >
                    {status.replace('_', ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileCode className="h-4 w-4" />
                  Type
                  {selectedTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedTypes.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {debtTypes.map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() =>
                      toggleFilter(type, selectedTypes, setSelectedTypes)
                    }
                  >
                    {type.replace(/_/g, ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {(selectedSeverities.length > 0 ||
              selectedStatuses.length > 0 ||
              selectedTypes.length > 0 ||
              searchQuery) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedSeverities([]);
                  setSelectedStatuses([]);
                  setSelectedTypes([]);
                  setSearchQuery('');
                }}
              >
                Clear all
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debt Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1">
                      Issue
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    Effort
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">
                    <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1">
                      Found
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((debt) => (
                  <tr
                    key={debt.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4">
                      <Link href={`/debt/${debt.id}`} className="block">
                        <p className="font-medium hover:text-primary transition-colors line-clamp-1">
                          {debt.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span className="font-mono text-xs">
                            {debt.filePath}:{debt.startLine}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{debt.repository}</span>
                        </div>
                        {/* Mobile-only badges */}
                        <div className="flex gap-2 mt-2 sm:hidden">
                          <SeverityBadge severity={debt.severity} />
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <SeverityBadge severity={debt.severity} />
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm">
                        {debt.debtType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <StatusBadge status={debt.status} />
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {debt.estimatedEffort}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                      {formatRelativeTime(debt.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {filteredItems.length} of {debtItems.length} items
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="w-8">
                1
              </Button>
              <Button variant="ghost" size="sm" className="w-8">
                2
              </Button>
              <Button variant="ghost" size="sm" className="w-8">
                3
              </Button>
              <Button variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
