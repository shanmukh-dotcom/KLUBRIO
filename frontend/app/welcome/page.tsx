'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, Calendar, Compass, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

const NEXT_STEPS = [
  {
    icon: <Users className="w-6 h-6 text-[#6366F1]" />,
    bg: 'bg-[#6366F1]/10',
    title: 'Discover Clubs',
    desc: 'Explore clubs from your college and find communities that match your interests.',
    href: '/student/clubs',
  },
  {
    icon: <Calendar className="w-6 h-6 text-[#10B981]" />,
    bg: 'bg-[#10B981]/10',
    title: 'Find Events',
    desc: 'Stay updated with workshops, hackathons, talks and more happening on your campus.',
    href: '/student/events',
  },
  {
    icon: <Compass className="w-6 h-6 text-orange-500" />,
    bg: 'bg-orange-50',
    title: 'Explore Opportunities',
    desc: 'Discover workshops, hackathons, and activities tailored to your interests.',
    href: '/student/discover',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <AuthLayout
      headline={<>
        <span style={{ color: '#0F172A' }}>You&apos;re all set!<br />Welcome to<br /></span>
        <span style={{ background: 'linear-gradient(90deg, #6366F1, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Klubrio.</span>
      </>}
      subtext={`Your campus community is now just a few clicks away. Discover verified clubs and premier events happening on campus.`}
      quote="Same people. New experiences. A campus that grows with you."
    >
      {/* Party popper illustration */}
      <div className="text-center mb-8">
        <div className="relative inline-block">
          <div className="text-6xl select-none">🎉</div>
          <div className="absolute -top-2 -right-2 text-yellow-400 text-lg">✦</div>
          <div className="absolute top-0 left-0 text-purple-400 text-sm">✦</div>
          <div className="absolute -bottom-1 right-0 text-pink-400 text-xs">✦</div>
        </div>
      </div>

      <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Welcome to Klubrio{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        Your account is ready. Here&apos;s what you can do next:
      </p>

      <div className="space-y-3 mb-8">
        {NEXT_STEPS.map(({ icon, bg, title, desc, href }) => (
          <button
            key={title}
            type="button"
            onClick={() => router.push(href)}
            className="w-full flex items-center gap-4 p-4 border border-gray-100 rounded-2xl hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
          >
            <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#0F172A] mb-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#6366F1] transition-colors shrink-0" />
          </button>
        ))}
      </div>

      <Button fullWidth size="lg" onClick={() => router.push('/student/home')}>
        Go to My Feed →
      </Button>

      <button
        type="button"
        onClick={() => router.push('/student/clubs')}
        className="w-full text-center text-sm font-semibold text-[#6366F1] hover:text-[#10B981] transition-colors underline underline-offset-2 mt-4"
      >
        Explore Clubs First
      </button>
    </AuthLayout>
  );
}
