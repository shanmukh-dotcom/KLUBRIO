'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast-context';
import { KlubrioLogo } from '@/components/ui/logo';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setSent(true);
    setLoading(false);
    toast('Password reset link sent! (Demo mode)', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <KlubrioLogo size="md" href="/" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {!sent ? (
            <>
              <h1 className="text-2xl font-black text-[#0F172A] mb-1 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>Reset your password</h1>
              <p className="text-gray-500 text-sm text-center mb-6">Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email address" type="email" placeholder="you@example.com" icon={<Mail className="w-4 h-4" />} value={email} onChange={e => setEmail(e.target.value)} />
                <Button type="submit" fullWidth size="lg" loading={loading}>Send Reset Link</Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4"><Mail className="w-8 h-8 text-emerald-500" /></div>
              <h2 className="text-xl font-bold text-[#0F172A] mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-6">We&apos;ve sent a password reset link to <strong>{email}</strong>. (Demo mode — no email actually sent.)</p>
              <Button variant="outline" fullWidth onClick={() => setSent(false)}>Send again</Button>
            </div>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-gray-500 hover:text-[#6366F1] flex items-center justify-center gap-1.5 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
