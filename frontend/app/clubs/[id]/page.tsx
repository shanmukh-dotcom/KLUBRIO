'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Calendar,
  MapPin,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Building2,
  Award,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import { MOCK_CLUBS, MOCK_EVENTS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/index';
import { KlubrioLogo } from '@/components/ui/logo';
import { useToast } from '@/lib/toast-context';

function ClubDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const clubId = params?.id as string;
  const club = MOCK_CLUBS.find((c) => c.id === clubId) || MOCK_CLUBS[0];
  const clubEvents = MOCK_EVENTS.filter((e) => e.clubId === club.id);

  const [isJoined, setIsJoined] = useState(club.isMember ?? false);
  const [memberCount, setMemberCount] = useState(club.membersCount ?? 2500);

  const handleToggleJoin = () => {
    if (isJoined) {
      setIsJoined(false);
      setMemberCount((c) => c - 1);
      toast(`You left ${club.name}.`, 'info');
    } else {
      setIsJoined(true);
      setMemberCount((c) => c + 1);
      toast(`Welcome to ${club.name}! You are now an active member.`, 'success');
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast('Club profile link copied to clipboard!', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-indigo-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-6">
              <KlubrioLogo size="sm" href="/" />
              <nav className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-600">
                <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
                <Link href="/events" className="hover:text-indigo-600 transition-colors">Events</Link>
                <Link href="/clubs" className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">Clubs</Link>
                <Link href="/student/discover" className="hover:text-indigo-600 transition-colors">Explore</Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/clubs"
                className="text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
              >
                My Clubs
              </Link>
              <Button size="sm" onClick={() => router.push('/signup')}>
                Join Klubrio
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/clubs"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Clubs</span>
          </Link>
        </div>

        {/* Club Banner Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden mb-8">
          <div className="h-48 sm:h-60 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#06B6D4] relative p-6 flex items-end justify-between text-white">
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={handleShare}
                className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all cursor-pointer shadow-sm"
                title="Share Club Link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white text-3xl sm:text-4xl flex items-center justify-center shadow-lg ring-4 ring-white/30">
                🌱
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1
                    className="text-2xl sm:text-4xl font-black text-white tracking-tight"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {club.name}
                  </h1>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 ring-4 ring-white/30" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-emerald-100">{club.tagline}</p>
              </div>
            </div>

            <div className="hidden sm:block">
              <Button
                variant={isJoined ? 'secondary' : 'glow'}
                size="md"
                onClick={handleToggleJoin}
              >
                {isJoined ? 'Joined ✓' : '+ Join Club'}
              </Button>
            </div>
          </div>

          {/* Club Info Strip */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
            <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>
                  <strong className="text-slate-900 font-black">{memberCount.toLocaleString()}</strong> Active Members
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>
                  <strong className="text-slate-900 font-black">{clubEvents.length}</strong> Upcoming Events
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>{club.college ?? 'Presidency University'}</span>
              </div>
            </div>

            <div className="sm:hidden">
              <Button
                variant={isJoined ? 'secondary' : 'glow'}
                size="md"
                fullWidth
                onClick={handleToggleJoin}
              >
                {isJoined ? 'Joined ✓' : '+ Join Club'}
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="p-6 sm:p-8">
            <h2 className="text-base font-black text-slate-900 mb-2 uppercase tracking-wider">
              About {club.name}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {club.description}
            </p>
          </div>
        </div>

        {/* Upcoming Events by This Club */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-black text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Upcoming Events by {club.name}
            </h2>
            <Link href="/events" className="text-xs font-bold text-indigo-600 hover:underline">
              View all campus events →
            </Link>
          </div>

          {clubEvents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <p className="text-sm font-bold text-slate-500">No events currently scheduled.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clubEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {event.date}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">{event.venue}</span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 mb-1">{event.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{event.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">
                      {event.registeredCount} registered
                    </span>
                    <Link
                      href={`/events/${event.id}`}
                      className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-800"
                    >
                      <span>View Event</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ClubDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8 text-sm font-semibold text-slate-500">Loading club profile...</div>}>
      <ClubDetailContent />
    </Suspense>
  );
}
