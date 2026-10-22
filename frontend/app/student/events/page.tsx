'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Search,
  MapPin,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle,
  Users,
  Ticket,
  ChevronRight,
  Sparkles,
  ExternalLink,
  X,
  FileCheck2
} from 'lucide-react';
import { Card, Badge, TabGroup, Modal } from '@/components/ui/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { MOCK_EVENTS, MOCK_CLUBS } from '@/mocks/data';
import type { Event } from '@/types';
import { cn } from '@/lib/utils';

interface ExtendedEvent extends Event {
  registeredStatus?: 'Open' | 'Closing Soon' | 'Full';
}

const ALL_STUDENT_EVENTS: ExtendedEvent[] = [
  ...MOCK_EVENTS.map((e, idx) => ({
    ...e,
    registeredStatus: (idx === 0 ? 'Closing Soon' : idx === 2 ? 'Full' : 'Open') as 'Open' | 'Closing Soon' | 'Full',
  })),
  {
    id: 'evt-past-1',
    title: 'Design Sprint 2026: Campus Redesign',
    description: '3-day design challenge tackling physical and digital navigation systems across Presidency University.',
    date: '2026-08-15',
    startTime: '10:00',
    endTime: '17:00',
    venue: 'Design Studio Lab 102',
    clubId: 'club-3',
    clubName: 'Design Nexus',
    college: 'Presidency University',
    collegeId: 'col-1',
    category: 'Design',
    registeredCount: 65,
    capacity: 65,
    status: 'completed',
    isRegistered: true,
    teamBased: true,
    registeredStatus: 'Full',
  },
  {
    id: 'evt-past-2',
    title: 'Founder Talk: Scaling from 0 to 1M Users',
    description: 'Interactive AMA with alumni founder Nikhil Verma on navigating venture capital and PMF.',
    date: '2026-07-22',
    startTime: '17:30',
    endTime: '19:30',
    venue: 'Main Auditorium',
    clubId: 'club-6',
    clubName: 'Entrepreneurship Cell',
    college: 'Presidency University',
    collegeId: 'col-1',
    category: 'Entrepreneurship',
    registeredCount: 220,
    capacity: 250,
    status: 'completed',
    isRegistered: true,
    teamBased: false,
    registeredStatus: 'Open',
  },
  {
    id: 'evt-9',
    title: 'Fullstack Next.js 16 Deep Dive',
    description: 'Master server actions, partial prerendering, and React 19 concurrent features with hands-on labs.',
    date: '2026-11-10',
    startTime: '14:00',
    endTime: '17:30',
    venue: 'Tech Lab 4, B Block',
    clubId: 'club-2',
    clubName: 'TechSphere',
    college: 'Presidency University',
    collegeId: 'col-1',
    category: 'Technology',
    registeredCount: 88,
    capacity: 100,
    status: 'published',
    isRegistered: false,
    teamBased: false,
    registeredStatus: 'Closing Soon',
  },
];

const CATEGORIES = ['All', 'Technology', 'Design', 'Sports', 'Entrepreneurship'];

export default function StudentEventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Track user registered IDs locally
  const [registeredIds, setRegisteredIds] = useState<Record<string, boolean>>({
    'evt-2': true,
    'evt-past-1': true,
    'evt-past-2': true,
  });

  // Modal State
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<ExtendedEvent | null>(null);
  const [rsvpModalEvent, setRsvpModalEvent] = useState<ExtendedEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute counts for tab badges
  const now = new Date('2026-09-01'); // anchor relative to current mock timestamps

  const upcomingEvents = useMemo(() => {
    return ALL_STUDENT_EVENTS.filter((e) => e.status !== 'completed');
  }, []);

  const registeredEvents = useMemo(() => {
    return ALL_STUDENT_EVENTS.filter((e) => !!registeredIds[e.id]);
  }, [registeredIds]);

  const pastEvents = useMemo(() => {
    return ALL_STUDENT_EVENTS.filter((e) => e.status === 'completed');
  }, []);

  // Filter based on active tab, search, category
  const displayedEvents = useMemo(() => {
    let baseList: ExtendedEvent[] = [];
    if (activeTab === 'upcoming') {
      baseList = upcomingEvents;
    } else if (activeTab === 'registered') {
      baseList = registeredEvents;
    } else {
      baseList = pastEvents;
    }

    return baseList.filter((evt) => {
      const matchesCategory =
        selectedCategory === 'All' || evt.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.clubName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeTab, upcomingEvents, registeredEvents, pastEvents, selectedCategory, searchQuery]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsvpModalEvent) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setRegisteredIds((prev) => ({ ...prev, [rsvpModalEvent.id]: true }));
      setIsSubmitting(false);
      toast(`Registered for ${rsvpModalEvent.title}! Your pass has been issued.`, 'success');
      setRsvpModalEvent(null);
    }, 600);
  };

  const handleCancelRegistration = (eventId: string, title: string) => {
    setRegisteredIds((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    toast(`Registration cancelled for ${title}.`, 'info');
  };

  const getStatusBadge = (evt: ExtendedEvent) => {
    if (evt.status === 'completed') {
      return <Badge variant="gray">Completed</Badge>;
    }
    if (registeredIds[evt.id]) {
      return <Badge variant="teal">Registered ✓</Badge>;
    }
    switch (evt.registeredStatus) {
      case 'Closing Soon':
        return <Badge variant="yellow">Closing Soon</Badge>;
      case 'Full':
        return <Badge variant="red">Full</Badge>;
      default:
        return <Badge variant="blue">Open</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Campus Events
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse upcoming workshops, hackathons, guest lectures, and cultural fests
          </p>
        </div>

        <Link href="/student/discover">
          <Button variant="outline" size="sm" icon={<Sparkles className="w-4 h-4 text-[#6366F1]" />}>
            Discover Trending
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <TabGroup
          active={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          tabs={[
            { id: 'upcoming', label: 'Upcoming', count: upcomingEvents.length },
            { id: 'registered', label: 'My Registered', count: registeredEvents.length },
            { id: 'past', label: 'Past Events', count: pastEvents.length },
          ]}
        />

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search events or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white rounded-xl text-xs sm:text-sm border border-gray-200 text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-gray-400 shrink-0">Category:</span>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 shrink-0',
                isSelected
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Event Cards List */}
      <div className="space-y-4">
        {displayedEvents.length === 0 ? (
          <Card padding="lg" className="text-center py-16 bg-white border border-dashed border-gray-200">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-3xl">
              {activeTab === 'registered' ? '🎟️' : '📅'}
            </div>
            <h3
              className="font-bold text-[#0F172A] text-lg mb-1"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {activeTab === 'registered'
                ? 'No registered events yet'
                : activeTab === 'past'
                ? 'No past events found'
                : 'No upcoming events match your filter'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 max-w-sm mx-auto mb-5 leading-relaxed">
              {activeTab === 'registered'
                ? 'You haven&apos;t reserved seats for any events yet. Check out the upcoming roster and register today!'
                : 'Try adjusting your search query or reset category filter to see campus events.'}
            </p>
            {activeTab === 'registered' ? (
              <Button variant="primary" size="sm" onClick={() => setActiveTab('upcoming')}>
                Explore Upcoming Events
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          displayedEvents.map((evt) => {
            const isRegistered = !!registeredIds[evt.id];
            const parsedDate = new Date(evt.date);
            const month = parsedDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const day = parsedDate.getDate();

            return (
              <Card
                key={evt.id}
                padding="none"
                className="overflow-hidden hover:shadow-md transition-all duration-200 border border-gray-100 bg-white"
              >
                <div className="flex flex-col md:flex-row items-stretch">
                  {/* Left Date Block */}
                  <div className="md:w-36 bg-gradient-to-b from-[#6366F1]/10 via-[#6366F1]/5 to-transparent border-b md:border-b-0 md:border-r border-gray-100 p-4 flex md:flex-col items-center justify-between md:justify-center text-center shrink-0">
                    <div className="flex md:flex-col items-center gap-1.5 md:gap-0">
                      <span className="text-xs font-bold text-[#6366F1] uppercase tracking-wider">
                        {month}
                      </span>
                      <span className="text-3xl md:text-4xl font-black text-[#0F172A] leading-none my-0.5">
                        {day}
                      </span>
                      <span className="text-[11px] text-gray-400">2026</span>
                    </div>

                    <div className="md:mt-3">
                      {getStatusBadge(evt)}
                    </div>
                  </div>

                  {/* Middle Content Details */}
                  <div className="flex-1 p-5 min-w-0 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#6366F1] bg-[#6366F1]/10 px-2.5 py-0.5 rounded-full">
                          {evt.clubName}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-500 font-medium">{evt.category}</span>
                        {evt.teamBased && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                              Team Participation
                            </span>
                          </>
                        )}
                      </div>

                      <h3
                        onClick={() => setSelectedEventForDetail(evt)}
                        className="text-base sm:text-lg font-bold text-[#0F172A] hover:text-[#6366F1] cursor-pointer transition-colors leading-snug"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {evt.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-500 pt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {evt.startTime} {evt.endTime ? `- ${evt.endTime}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate max-w-[200px]">{evt.venue}</span>
                      </div>
                      {evt.capacity && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {evt.registeredCount}/{evt.capacity} seats filled
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions Block */}
                  <div className="border-t md:border-t-0 md:border-l border-gray-100 p-4 md:w-48 flex md:flex-col items-center justify-center gap-2 bg-gray-50/50 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={() => setSelectedEventForDetail(evt)}
                      className="text-xs"
                    >
                      View Details
                    </Button>

                    {evt.status === 'completed' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        icon={<FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />}
                        onClick={() => toast('Certificate downloaded to your downloads folder.', 'success')}
                        className="text-xs"
                      >
                        Certificate
                      </Button>
                    ) : isRegistered ? (
                      <div className="w-full flex flex-col gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          icon={<Ticket className="w-3.5 h-3.5 text-[#6366F1]" />}
                          onClick={() => toast(`QR Pass displayed for ${evt.title}`, 'info')}
                          className="text-xs border-[#6366F1] text-[#6366F1]"
                        >
                          View Pass
                        </Button>
                        <button
                          onClick={() => handleCancelRegistration(evt.id, evt.title)}
                          className="text-[11px] text-red-500 hover:text-red-700 text-center font-medium transition-colors"
                        >
                          Cancel RSVP
                        </button>
                      </div>
                    ) : evt.registeredStatus === 'Full' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        disabled
                        className="text-xs opacity-60"
                      >
                        Waitlist Full
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => setRsvpModalEvent(evt)}
                        className="text-xs"
                      >
                        Register
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Event Details Modal */}
      <Modal
        open={!!selectedEventForDetail}
        onClose={() => setSelectedEventForDetail(null)}
        title="Event Details"
        size="lg"
      >
        {selectedEventForDetail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#6366F1]/10 text-[#6366F1]">
                {selectedEventForDetail.category}
              </span>
              {getStatusBadge(selectedEventForDetail)}
            </div>

            <div>
              <h2
                className="text-xl font-bold text-[#0F172A]"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {selectedEventForDetail.title}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Organized by <strong className="text-gray-700">{selectedEventForDetail.clubName}</strong> • {selectedEventForDetail.college}
              </p>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
              {selectedEventForDetail.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-gray-100 bg-white">
                <span className="text-gray-400 block mb-0.5">Date & Time</span>
                <span className="font-semibold text-gray-800">
                  {selectedEventForDetail.date} • {selectedEventForDetail.startTime}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-gray-100 bg-white">
                <span className="text-gray-400 block mb-0.5">Venue</span>
                <span className="font-semibold text-gray-800">{selectedEventForDetail.venue}</span>
              </div>
              <div className="p-3 rounded-xl border border-gray-100 bg-white">
                <span className="text-gray-400 block mb-0.5">Format</span>
                <span className="font-semibold text-gray-800">
                  {selectedEventForDetail.teamBased ? 'Team Participation' : 'Individual Participation'}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-gray-100 bg-white">
                <span className="text-gray-400 block mb-0.5">Capacity</span>
                <span className="font-semibold text-gray-800">
                  {selectedEventForDetail.registeredCount} / {selectedEventForDetail.capacity || 'Unlimited'} seats
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setSelectedEventForDetail(null)}>
                Close
              </Button>
              {!registeredIds[selectedEventForDetail.id] && selectedEventForDetail.status !== 'completed' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const evt = selectedEventForDetail;
                    setSelectedEventForDetail(null);
                    setRsvpModalEvent(evt);
                  }}
                >
                  Proceed to Register
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* RSVP Modal */}
      <Modal
        open={!!rsvpModalEvent}
        onClose={() => setRsvpModalEvent(null)}
        title="Confirm Event Registration"
        size="md"
      >
        {rsvpModalEvent && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600">
              You are registering for <strong className="text-gray-900">{rsvpModalEvent.title}</strong> on{' '}
              {rsvpModalEvent.date} at {rsvpModalEvent.venue}.
            </div>

            <Input
              label="Student Name"
              defaultValue={user?.fullName || 'Ballaya'}
              required
            />
            <Input
              label="University Email"
              type="email"
              defaultValue={user?.email || 'ballaya@example.com'}
              required
            />
            <Input
              label="Department / Branch"
              defaultValue={user?.branch || 'CSE (AI & ML)'}
              required
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setRsvpModalEvent(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Confirm Ticket
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
