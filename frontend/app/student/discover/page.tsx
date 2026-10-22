'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  Users,
  Flame,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle2,
  X,
  Share2
} from 'lucide-react';
import { Card, Badge, Avatar, Modal } from '@/components/ui/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { MOCK_EVENTS, MOCK_CLUBS } from '@/mocks/data';
import type { Event, Club } from '@/types';
import { cn } from '@/lib/utils';

// Additional sample events to make discovery rich across all categories
const DISCOVER_EVENTS: Event[] = [
  ...MOCK_EVENTS,
  {
    id: 'evt-6',
    title: 'Inter-College Football Championship 2026',
    description: 'The biggest sports showdown of the semester. 16 college teams competing for the coveted Trophy.',
    date: '2026-11-12',
    startTime: '15:00',
    endTime: '19:30',
    venue: 'University Main Sports Ground',
    clubId: 'club-4',
    clubName: 'Sports Club',
    college: 'Presidency University',
    collegeId: 'col-1',
    category: 'Sports',
    tags: ['Football', 'Championship', 'Athletics'],
    registeredCount: 84,
    capacity: 100,
    status: 'published',
    isRegistered: false,
    teamBased: true,
  },
  {
    id: 'evt-7',
    title: 'Kala Utsav: Annual Fine Arts & Graffiti Expo',
    description: 'Immerse in campus creativity featuring live canvas painting, digital sketching showdowns, and acoustic performances.',
    date: '2026-11-18',
    startTime: '13:00',
    endTime: '18:00',
    venue: 'Student Activity Amphitheatre',
    clubId: 'club-3',
    clubName: 'Design Nexus',
    college: 'Presidency University',
    collegeId: 'col-1',
    category: 'Arts',
    tags: ['Art', 'Culture', 'Exhibition'],
    registeredCount: 145,
    capacity: 200,
    status: 'published',
    isRegistered: false,
    teamBased: false,
  },
  {
    id: 'evt-8',
    title: 'Venture Pitch Arena: Angel Demo Day',
    description: '10 shortlisted student startups pitch to top seed investors & founders. Funding commitments up to ₹5 Lakhs.',
    date: '2026-11-28',
    startTime: '14:00',
    endTime: '18:30',
    venue: 'Incubation Center Auditorium',
    clubId: 'club-6',
    clubName: 'Entrepreneurship Cell',
    college: 'Presidency University',
    collegeId: 'col-1',
    category: 'Entrepreneurship',
    tags: ['Startup', 'Pitch', 'Funding'],
    registeredCount: 110,
    capacity: 120,
    status: 'published',
    isRegistered: false,
    teamBased: true,
  },
];

const CATEGORIES = [
  'All',
  'Technology',
  'Design',
  'Sports',
  'Arts',
  'Entrepreneurship',
];

const CLUB_EMOJIS: Record<string, string> = {
  'HARVEST': '🌱',
  'TechSphere': '⚡',
  'Design Nexus': '🎨',
  'Sports Club': '🏆',
  'AI & Robotics Club': '🤖',
  'Entrepreneurship Cell': '🚀',
};

export default function DiscoverPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [registeredEventIds, setRegisteredEventIds] = useState<Record<string, boolean>>({
    'evt-2': true,
  });
  const [joinedClubIds, setJoinedClubIds] = useState<Record<string, boolean>>({
    'club-1': true,
  });

  // Modal State for registration
  const [selectedEventForModal, setSelectedEventForModal] = useState<Event | null>(null);
  const [regForm, setRegForm] = useState({
    fullName: user?.fullName || 'Ballaya',
    email: user?.email || 'ballaya@example.com',
    rollNumber: 'PU2023CSE1024',
    teamName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return DISCOVER_EVENTS.filter((evt) => {
      const matchesCategory =
        selectedCategory === 'All' || evt.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.clubName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.venue.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  // Filtered Clubs
  const filteredClubs = useMemo(() => {
    return MOCK_CLUBS.filter((club) => {
      const matchesCategory =
        selectedCategory === 'All' || club.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleRegisterClick = (event: Event) => {
    if (registeredEventIds[event.id]) {
      toast(`You are already registered for ${event.title}`, 'info');
      return;
    }
    setSelectedEventForModal(event);
  };

  const handleConfirmRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForModal) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setRegisteredEventIds((prev) => ({
        ...prev,
        [selectedEventForModal.id]: true,
      }));
      setIsSubmitting(false);
      toast(`Registered successfully for ${selectedEventForModal.title}! Check your email for QR pass.`, 'success');
      setSelectedEventForModal(null);
    }, 600);
  };

  const handleToggleClubJoin = (club: Club) => {
    const isJoined = joinedClubIds[club.id];
    setJoinedClubIds((prev) => ({
      ...prev,
      [club.id]: !isJoined,
    }));
    if (isJoined) {
      toast(`You left ${club.name}`, 'info');
    } else {
      toast(`Welcome! You are now a member of ${club.name} 🎉`, 'success');
    }
  };

  const handleShare = (title: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast(`Link to "${title}" copied to clipboard!`, 'info');
    } else {
      toast(`Sharing "${title}"`, 'info');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white p-6 sm:p-8 lg:p-10 shadow-lg overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-emerald-300 border border-white/15">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover Campus Opportunities</span>
          </div>
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Explore Clubs, Hackathons & Meetups
          </h1>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            Find the communities that match your ambitions. RSVP for workshops, join premier student organizations, and grow your network.
          </p>

          {/* Search Bar inside Hero */}
          <div className="pt-2">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by event, club, topic, or venue..."
                className="w-full pl-12 pr-10 py-3.5 bg-white text-[#0F172A] rounded-2xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#6366F1]/30 shadow-xl transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </span>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer',
                isActive
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#3B82F6] text-white shadow-md shadow-indigo-200 scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#6366F1] hover:text-[#6366F1]'
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Section 1: Trending Events */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-[#0F172A]"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Trending Events
              </h2>
              <p className="text-xs text-gray-500">
                Popular happenings curated for students this month
              </p>
            </div>
          </div>
          <Link
            href="/student/events"
            className="text-sm font-semibold text-[#6366F1] hover:text-[#4F46E5] flex items-center gap-1 transition-colors"
          >
            All Events <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {filteredEvents.length === 0 ? (
          <Card padding="lg" className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-2xl">
              🔍
            </div>
            <h3 className="font-bold text-[#0F172A] text-base mb-1">No events found</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              We couldn&apos;t find any events matching &ldquo;{searchQuery}&rdquo; in category &ldquo;{selectedCategory}&rdquo;.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
            >
              Reset Filters
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((evt) => {
              const isRegistered = !!registeredEventIds[evt.id];
              const parsedDate = new Date(evt.date);
              const month = parsedDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
              const day = parsedDate.getDate();
              const percentFull = evt.capacity
                ? Math.min(100, Math.round((evt.registeredCount / evt.capacity) * 100))
                : null;

              return (
                <Card
                  key={evt.id}
                  padding="none"
                  className="flex flex-col overflow-hidden hover:shadow-lg transition-all duration-200 border border-gray-100 group"
                >
                  {/* Top Colored Banner / Accent */}
                  <div className="h-32 bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#10B981] p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between z-10">
                      <span className="px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-md text-[11px] font-semibold text-white tracking-wide">
                        {evt.category}
                      </span>
                      <button
                        onClick={() => handleShare(evt.title)}
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-colors"
                        title="Share event"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between z-10 text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {CLUB_EMOJIS[evt.clubName] || '🏛️'}
                        </span>
                        <span className="text-xs font-medium text-white/90 truncate max-w-[170px]">
                          {evt.clubName}
                        </span>
                      </div>
                      {evt.teamBased && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                          Team Event
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5">
                      {/* Date & Time pill */}
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#6366F1]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {month} {day}, 2026 • {evt.startTime}
                        </span>
                      </div>

                      <h3
                        className="font-bold text-[#0F172A] text-base leading-snug line-clamp-2 group-hover:text-[#6366F1] transition-colors"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {evt.title}
                      </h3>

                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{evt.venue}</span>
                      </div>
                    </div>

                    {/* Bottom Area: Capacity & Action Button */}
                    <div className="pt-2 border-t border-gray-100 space-y-3">
                      {percentFull !== null && (
                        <div>
                          <div className="flex justify-between text-[11px] font-medium text-gray-400 mb-1">
                            <span>{evt.registeredCount} registered</span>
                            <span>{evt.capacity} capacity ({percentFull}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-300',
                                percentFull > 85 ? 'bg-amber-500' : 'bg-[#10B981]'
                              )}
                              style={{ width: `${percentFull}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {isRegistered ? (
                          <div className="w-full py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Registered
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            onClick={() => handleRegisterClick(evt)}
                          >
                            Register Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Recommended Clubs */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 text-[#6366F1]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-[#0F172A]"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Recommended Clubs
              </h2>
              <p className="text-xs text-gray-500">
                Join active campus communities aligning with your interests
              </p>
            </div>
          </div>
          <Link
            href="/student/clubs"
            className="text-sm font-semibold text-[#6366F1] hover:text-[#4F46E5] flex items-center gap-1 transition-colors"
          >
            Explore All Clubs <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClubs.map((club) => {
            const isJoined = !!joinedClubIds[club.id];
            const emoji = CLUB_EMOJIS[club.name] || '🏛️';

            return (
              <Card
                key={club.id}
                padding="md"
                className="flex flex-col justify-between hover:shadow-md transition-all duration-200 border border-gray-100 space-y-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1]/10 to-[#10B981]/15 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3
                        className="font-bold text-[#0F172A] text-base truncate hover:text-[#6366F1] cursor-pointer"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {club.name}
                      </h3>
                      <Badge variant="violet" className="text-[10px] shrink-0">
                        {club.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{club.tagline}</p>
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                      {club.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {(club.membersCount / 1000).toFixed(1)}k members
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {club.eventsCount} events
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant={isJoined ? 'outline' : 'primary'}
                    onClick={() => handleToggleClubJoin(club)}
                    className={cn(isJoined && 'border-emerald-500 text-emerald-600 hover:bg-emerald-50')}
                  >
                    {isJoined ? 'Joined ✓' : 'Join'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Registration Modal */}
      <Modal
        open={!!selectedEventForModal}
        onClose={() => setSelectedEventForModal(null)}
        title="Event Registration Pass"
        size="md"
      >
        {selectedEventForModal && (
          <form onSubmit={handleConfirmRegistration} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-bold text-lg shrink-0">
                {CLUB_EMOJIS[selectedEventForModal.clubName] || '📅'}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-[#0F172A] truncate">
                  {selectedEventForModal.title}
                </h4>
                <p className="text-xs text-gray-500">
                  Hosted by {selectedEventForModal.clubName} • {selectedEventForModal.venue}
                </p>
                <p className="text-xs text-[#6366F1] font-semibold mt-1">
                  {selectedEventForModal.date} at {selectedEventForModal.startTime}
                </p>
              </div>
            </div>

            <Input
              label="Full Name"
              value={regForm.fullName}
              onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
              required
            />

            <Input
              label="Student Email"
              type="email"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              required
            />

            <Input
              label="Roll Number / Student ID"
              value={regForm.rollNumber}
              onChange={(e) => setRegForm({ ...regForm, rollNumber: e.target.value })}
              required
            />

            {selectedEventForModal.teamBased && (
              <Input
                label="Team Name (Required for team event)"
                placeholder="e.g. CodeCraft Squad"
                value={regForm.teamName}
                onChange={(e) => setRegForm({ ...regForm, teamName: e.target.value })}
                required
              />
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedEventForModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Confirm RSVP
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
