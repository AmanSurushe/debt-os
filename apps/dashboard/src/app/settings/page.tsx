'use client';

import { useState } from 'react';
import {
  User,
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Github,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';

// Mock data
const user = {
  name: 'John Doe',
  email: 'john.doe@acme.com',
  avatarUrl: null,
  provider: 'github',
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
};

const apiKeys = [
  {
    id: '1',
    name: 'CI/CD Pipeline',
    prefix: 'dob_1234',
    scopes: ['repos:read', 'scans:write'],
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'VS Code Extension',
    prefix: 'dob_5678',
    scopes: ['repos:read', 'debt:read'],
    lastUsedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Monitoring Script',
    prefix: 'dob_9012',
    scopes: ['repos:read'],
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function CreateApiKeyDialog() {
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    // Simulate key creation
    setNewKey('dob_sk_live_abcdefghijklmnopqrstuvwxyz123456');
  };

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for programmatic access to DEBT-OS.
          </DialogDescription>
        </DialogHeader>

        {!newKey ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                placeholder="e.g., CI/CD Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this key
              </p>
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">repos:read</Badge>
                <Badge variant="outline">repos:write</Badge>
                <Badge variant="outline">scans:read</Badge>
                <Badge variant="outline">scans:write</Badge>
                <Badge variant="outline">debt:read</Badge>
                <Badge variant="outline">debt:write</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                All scopes are included by default
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name}>
                Create Key
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-yellow-950 border border-yellow-800 p-4">
              <p className="text-sm text-yellow-400 font-medium mb-2">
                Make sure to copy your API key now. You won't be able to see it
                again!
              </p>
            </div>

            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <Input value={newKey} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setNewKey(null);
                  setName('');
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account and API keys
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatarUrl || ''} />
                  <AvatarFallback className="bg-secondary text-xl">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{user.name}</h3>
                  <p className="text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="gap-1">
                      <Github className="h-3 w-3" />
                      Connected via GitHub
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" defaultValue={user.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" defaultValue={user.email} disabled />
                  <p className="text-xs text-muted-foreground">
                    Email is managed by your GitHub account
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>API Keys</CardTitle>
              <CreateApiKeyDialog />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{key.name}</span>
                        <code className="rounded bg-secondary px-2 py-0.5 text-xs">
                          {key.prefix}...
                        </code>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Created {formatRelativeTime(key.createdAt)}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span>
                          {key.lastUsedAt
                            ? `Last used ${formatRelativeTime(key.lastUsedAt)}`
                            : 'Never used'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {key.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant="outline"
                            className="text-xs"
                          >
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive self-end sm:self-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {apiKeys.length === 0 && (
                  <div className="text-center py-8">
                    <Key className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="font-medium">No API keys</h3>
                    <p className="text-muted-foreground text-sm">
                      Create your first API key to get started
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
