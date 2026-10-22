'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Sparkles,
  Ticket,
  ShieldCheck,
  Building2,
  Tag
} from 'lucide-react';
import { MOCK_EVENTS, MOCK_CLUBS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { Badge, Modal } from '@/components/ui/index';
import { KlubrioLogo } from '@/components/ui/logo';
import { useToast } from '@/lib/toast-context';

function EventDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const eventId = params?.id as string;
  const event = MOCK_EVENTS.find((e) => e.id === eventId) || MOCK_EVENTS[0];
  const club = MOCK_CLUBS.find((c) => c.id === event.clubId) || MOCK_CLUBS[0];

  const [isRegistered, setIsRegistered] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    year: '3rd Year',
    branch: 'CSE (AI & ML)',
  });

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast('Event link copied to clipboard!', 'info');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistered(true);
    setShowRegisterModal(false);
    toast(`Registration confirmed for ${event.title}!`, 'success');
  };

  const parsedDate = new Date(event.date);
  const formattedDate = parsedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
                <Link href="/events" className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">Events</Link>
                <Link href="/clubs" className="hover:text-indigo-600 transition-colors">Clubs</Link>
                <Link href="/student/discover" className="hover:text-indigo-600 transition-colors">Explore</Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/events"
                className="text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
              >
                Student Hub
              </Link>
              <Button size="sm" onClick={() => router.push('/signup')}>
                Join Klubrio
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>
        </div>

        {/* Hero Banner Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden mb-8">
          {/* Header Graphic */}
          <div className="h-64 sm:h-80 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 relative flex items-center justify-center p-6 text-white overflow-hidden">
            <div className="absolute inset-0 bg-radial from-transparent to-black/30 pointer-events-none" />
            <div className="text-7xl sm:text-8xl select-none filter drop-shadow-md">🚀</div>

            <div className="absolute top-4 left-4 flex gap-2">
              <Badge variant="teal" className="text-xs font-black shadow-sm">
                {event.category}
              </Badge>
              {event.teamBased && (
                <Badge variant="blue" className="text-xs font-black shadow-sm">
                  Team Event
                </Badge>
              )}
            </div>

            <button
              onClick={handleShare}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all cursor-pointer shadow-sm"
              title="Share Event Link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Details Bar */}
          <div className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-100 transition-colors"
                  >
                    Organised by {event.clubName}
                  </Link>
                  <span className="text-xs text-slate-400 font-semibold">·</span>
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Event
                  </span>
                </div>

                <h1
                  className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {event.title}
                </h1>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isRegistered ? (
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 rounded-full font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Registered ✓</span>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    icon={<Ticket className="w-5 h-5 text-white" />}
                    onClick={() => setShowRegisterModal(true)}
                  >
                    Register Now
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Meta Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</p>
                  <p className="text-xs sm:text-sm font-black text-slate-900">{formattedDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100">
                <Clock className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Time</p>
                  <p className="text-xs sm:text-sm font-black text-slate-900">
                    {event.startTime} – {event.endTime ?? '7:00 PM'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-cyan-50/60 border border-cyan-100">
                <MapPin className="w-5 h-5 text-cyan-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Venue</p>
                  <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{event.venue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
              <h2
                className="text-xl font-black text-slate-900 mb-4"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                About This Event
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line mb-6">
                {event.description}
              </p>

              {event.tags && event.tags.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                    Topics & Technologies
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Organiser Info & Capacity */}
          <div className="space-y-6">
            {/* Capacity Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3 uppercase tracking-wider">
                Registration Status
              </h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Seats Claimed</span>
                <span className="text-xs font-black text-slate-900">
                  {event.registeredCount} / {event.capacity ?? 150}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2.5 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((event.registeredCount / (event.capacity ?? 150)) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Registrations are actively processed on a first-come, first-served basis.
              </p>
            </div>

            {/* Club Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3 uppercase tracking-wider">
                Club Information
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-lg font-black shadow-xs">
                  🌱
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{club.name}</p>
                  <p className="text-xs text-slate-500 font-semibold">{club.tagline}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 line-clamp-3 mb-4">{club.description}</p>
              <Link
                href={`/clubs/${club.id}`}
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs rounded-xl hover:bg-indigo-100 transition-colors"
              >
                View Club Profile
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Registration Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title={`Register for ${event.title}`}
        description="Confirm your student registration details below to receive your entry pass."
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              defaultValue="Ballaya"
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Student Email</label>
            <input
              type="email"
              required
              defaultValue="ballaya@presidencyuniversity.in"
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Year of Study</label>
              <select className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option>1st Year</option>
                <option>2nd Year</option>
                <option selected>3rd Year</option>
                <option>4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                defaultValue="CSE (AI & ML)"
                className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRegisterModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Confirm Registration
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function EventDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8 text-sm font-semibold text-slate-500">Loading event details...</div>}>
      <EventDetailContent />
    </Suspense>
  );
}
