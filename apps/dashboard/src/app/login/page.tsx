'use client';

import { Github, Bug, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center space-y-4 pb-8">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-foreground">
                <Bug className="h-8 w-8 text-background" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold">DEBT-OS</h1>
              <p className="text-muted-foreground mt-2">
                AI-powered technical debt detection and remediation
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Multi-agent debt detection</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>AI-powered prioritization</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span>Automated remediation planning</span>
              </div>
            </div>

            {/* Login Button */}
            <Button className="w-full h-12 text-base" asChild>
              <a href="/api/auth/github">
                <Github className="mr-2 h-5 w-5" />
                Continue with GitHub
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>

            {/* Terms */}
            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <a href="/api/auth/github" className="text-primary hover:underline">
            Sign up for free
          </a>
        </p>
      </div>
    </div>
  );
}
