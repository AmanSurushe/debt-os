'use client';

import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  PieChart,
  FileCode,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';

// Mock data
const trendData = [
  { date: 'Nov 1', critical: 12, high: 45, medium: 78, low: 120, total: 255 },
  { date: 'Nov 8', critical: 10, high: 42, medium: 75, low: 118, total: 245 },
  { date: 'Nov 15', critical: 8, high: 38, medium: 72, low: 115, total: 233 },
  { date: 'Nov 22', critical: 8, high: 35, medium: 68, low: 110, total: 221 },
  { date: 'Nov 29', critical: 6, high: 32, medium: 65, low: 105, total: 208 },
  { date: 'Dec 6', critical: 5, high: 28, medium: 62, low: 100, total: 195 },
  { date: 'Dec 13', critical: 4, high: 25, medium: 58, low: 95, total: 182 },
  { date: 'Dec 20', critical: 2, high: 22, medium: 55, low: 90, total: 169 },
];

const severityData = [
  { name: 'Critical', value: 8, color: '#dc2626' },
  { name: 'High', value: 42, color: '#f97316' },
  { name: 'Medium', value: 89, color: '#eab308' },
  { name: 'Low', value: 108, color: '#3b82f6' },
];

const typeData = [
  { type: 'Complexity', count: 45 },
  { type: 'Duplication', count: 38 },
  { type: 'Code Smell', count: 35 },
  { type: 'Dependencies', count: 28 },
  { type: 'Missing Tests', count: 22 },
  { type: 'Security', count: 18 },
  { type: 'Architecture', count: 15 },
  { type: 'Documentation', count: 12 },
];

const hotspots = [
  {
    file: 'src/controllers/AuthController.ts',
    count: 15,
    critical: 2,
    high: 5,
  },
  { file: 'src/services/UserService.ts', count: 12, critical: 1, high: 4 },
  { file: 'src/utils/validation.ts', count: 10, critical: 0, high: 3 },
  { file: 'src/api/handlers/payment.ts', count: 9, critical: 1, high: 2 },
  { file: 'src/components/Dashboard.tsx', count: 8, critical: 0, high: 2 },
  { file: 'src/lib/http.ts', count: 7, critical: 0, high: 1 },
  { file: 'src/store/reducers/user.ts', count: 6, critical: 0, high: 2 },
  { file: 'src/hooks/useAuth.ts', count: 5, critical: 0, high: 1 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track technical debt trends and identify hotspots
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30">
            <SelectTrigger className="w-40">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Debt Reduction Rate
                </p>
                <p className="text-3xl font-bold mt-1">34%</p>
              </div>
              <div className="rounded-lg bg-green-950 p-3">
                <TrendingDown className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-green-500 mt-2">
              86 items resolved this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Avg Resolution Time
                </p>
                <p className="text-3xl font-bold mt-1">2.4 days</p>
              </div>
              <div className="rounded-lg bg-blue-950 p-3">
                <TrendingDown className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-blue-500 mt-2">
              0.5 days faster than last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  New Issues Rate
                </p>
                <p className="text-3xl font-bold mt-1">12/week</p>
              </div>
              <div className="rounded-lg bg-orange-950 p-3">
                <TrendingUp className="h-6 w-6 text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-orange-500 mt-2">
              3 more than last week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Debt Trend Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="critical"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                  name="Critical"
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  name="High"
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={false}
                  name="Medium"
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Low"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Severity Distribution */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-500" />
              Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {severityData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {item.name} ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Debt by Type */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Debt by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    horizontal={false}
                  />
                  <XAxis type="number" stroke="#71717a" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="type"
                    stroke="#71717a"
                    fontSize={12}
                    width={100}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    name="Count"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hotspots */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-red-500" />
            Debt Hotspots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hotspots.map((hotspot, index) => (
              <div
                key={hotspot.file}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-mono text-sm break-all">{hotspot.file}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {hotspot.critical > 0 && (
                        <Badge variant="critical">
                          {hotspot.critical} critical
                        </Badge>
                      )}
                      {hotspot.high > 0 && (
                        <Badge variant="high">{hotspot.high} high</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{hotspot.count}</p>
                  <p className="text-sm text-muted-foreground">issues</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
