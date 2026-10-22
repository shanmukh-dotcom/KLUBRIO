'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Check,
  Plus,
  ShieldCheck,
  Compass,
  X
} from 'lucide-react';
import { Card, Badge, TabGroup, Modal } from '@/components/ui/index';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { MOCK_CLUBS } from '@/mocks/data';
import type { Club } from '@/types';
import { cn } from '@/lib/utils';

const CLUB_ICONS: Record<string, string> = {
  'HARVEST': '🌱',
  'TechSphere': '⚡',
  'Design Nexus': '🎨',
  'Sports Club': '🏆',
  'AI & Robotics Club': '🤖',
  'Entrepreneurship Cell': '🚀',
  'Literary & Debating Society': '📜',
  'Google Developer Student Club': '💻',
  'SoundWaves Music Society': '🎵',
};

const EXTRA_CLUBS: Club[] = [
  ...MOCK_CLUBS,
  {
    id: 'club-7',
    name: 'Literary & Debating Society',
    tagline: 'Art of Rhetoric and Expression',
    description: 'Fostering intellectual discourse, parliamentary debating, creative writing, and poetry slams across campus.',
    category: 'Arts',
    membersCount: 820,
    eventsCount: 6,
    college: 'Presidency University',
    collegeId: 'col-1',
    isFollowing: false,
    isMember: false,
  },
  {
    id: 'club-8',
    name: 'Google Developer Student Club',
    tagline: 'Connect. Learn. Grow.',
    description: 'University based community group for students interested in Google developer technologies, mobile apps, and Cloud.',
    category: 'Technology',
    membersCount: 3100,
    eventsCount: 18,
    college: 'Presidency University',
    collegeId: 'col-1',
    isFollowing: true,
    isMember: false,
  },
  {
    id: 'club-9',
    name: 'SoundWaves Music Society',
    tagline: 'Rhythms of Campus Life',
    description: 'Jam sessions, acoustic nights, annual battle of the bands, and multi-genre musical collaborations.',
    category: 'Arts',
    membersCount: 1450,
    eventsCount: 9,
    college: 'Presidency University',
    collegeId: 'col-1',
    isFollowing: false,
    isMember: false,
  },
];

const CATEGORIES = ['All', 'Technology', 'Design', 'Sports', 'Entrepreneurship', 'Arts'];

export default function StudentClubsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Track memberships locally
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({
    'club-1': true,
  });

  // Modal State for viewing details
  const [selectedClubForModal, setSelectedClubForModal] = useState<Club | null>(null);

  const toggleMembership = (club: Club) => {
    const current = !!membershipMap[club.id];
    setMembershipMap((prev) => ({
      ...prev,
      [club.id]: !current,
    }));
    if (current) {
      toast(`You left ${club.name}`, 'info');
    } else {
      toast(`Joined ${club.name}! You will receive announcements & event invites.`, 'success');
    }
  };

  // Filtered lists
  const myClubs = useMemo(() => {
    return EXTRA_CLUBS.filter((c) => !!membershipMap[c.id]);
  }, [membershipMap]);

  const recommendedClubs = useMemo(() => {
    // Recommend clubs with high member counts or specific interest matches
    return EXTRA_CLUBS.filter((c) => !membershipMap[c.id] && c.membersCount > 1000);
  }, [membershipMap]);

  const displayedClubs = useMemo(() => {
    let base = EXTRA_CLUBS;
    if (activeTab === 'my_clubs') {
      base = myClubs;
    } else if (activeTab === 'recommended') {
      base = recommendedClubs;
    }

    return base.filter((c) => {
      const matchesCat =
        selectedCategory === 'All' || c.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [activeTab, myClubs, recommendedClubs, selectedCategory, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Clubs & Communities
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Discover student bodies, societies, and interest chapters across Presidency University
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/student/discover">
            <Button variant="secondary" size="sm" icon={<Compass className="w-4 h-4 text-[#6366F1]" />}>
              Explore Events
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <TabGroup
          active={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          tabs={[
            { id: 'all', label: 'All Clubs', count: EXTRA_CLUBS.length },
            { id: 'my_clubs', label: 'My Clubs', count: myClubs.length },
            { id: 'recommended', label: 'Recommended', count: recommendedClubs.length },
          ]}
        />

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clubs by name or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white rounded-xl text-xs sm:text-sm border border-gray-200 text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
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

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-gray-400 flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3" />
          Category:
        </span>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 shrink-0 cursor-pointer',
                isSelected
                  ? 'bg-[#6366F1] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#6366F1] hover:text-[#6366F1]'
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Clubs Grid */}
      {displayedClubs.length === 0 ? (
        <Card padding="lg" className="text-center py-16 bg-white border border-dashed border-gray-200">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-3xl">
            🏛️
          </div>
          <h3
            className="font-bold text-[#0F172A] text-lg mb-1"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {activeTab === 'my_clubs'
              ? 'You have not joined any clubs yet'
              : 'No matching clubs found'}
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-sm mx-auto mb-5">
            {activeTab === 'my_clubs'
              ? 'Browse the complete club directory to find student organizations that align with your passions.'
              : 'Try searching for different keywords or clear your category filter.'}
          </p>
          {activeTab === 'my_clubs' ? (
            <Button variant="primary" size="sm" onClick={() => setActiveTab('all')}>
              Explore All Clubs
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
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedClubs.map((club) => {
            const isMember = !!membershipMap[club.id];
            const emoji = CLUB_ICONS[club.name] || '🏛️';

            return (
              <Card
                key={club.id}
                padding="none"
                className="flex flex-col justify-between overflow-hidden hover:shadow-lg transition-all duration-200 border border-gray-100 bg-white group"
              >
                {/* Top Banner with Logo */}
                <div className="h-28 bg-gradient-to-r from-gray-900 via-[#1E1B4B] to-[#312E81] p-4 relative flex items-start justify-between">
                  <Badge variant="default" className="bg-white/20 text-white backdrop-blur-md border-0 text-[11px]">
                    {club.category}
                  </Badge>

                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Official Club</span>
                  </div>
                </div>

                {/* Overlapping Club Icon */}
                <div className="px-5 -mt-9 relative z-10 flex items-end justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center text-3xl shrink-0">
                    {emoji}
                  </div>

                  <Button
                    size="sm"
                    variant={isMember ? 'outline' : 'primary'}
                    onClick={() => toggleMembership(club)}
                    className={cn(
                      'text-xs font-semibold px-4',
                      isMember && 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                    )}
                    icon={isMember ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  >
                    {isMember ? 'Joined' : 'Join'}
                  </Button>
                </div>

                {/* Content */}
                <div className="p-5 pt-3 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3
                      onClick={() => setSelectedClubForModal(club)}
                      className="text-lg font-bold text-[#0F172A] hover:text-[#6366F1] cursor-pointer transition-colors"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {club.name}
                    </h3>
                    <p className="text-xs font-medium text-[#6366F1]">{club.tagline}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed pt-1">
                      {club.description}
                    </p>
                  </div>

                  {/* Club stats & action */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
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

                    <button
                      onClick={() => setSelectedClubForModal(club)}
                      className="text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5] flex items-center gap-0.5"
                    >
                      Details <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Club Details Modal */}
      <Modal
        open={!!selectedClubForModal}
        onClose={() => setSelectedClubForModal(null)}
        title={selectedClubForModal?.name || 'Club Info'}
        size="md"
      >
        {selectedClubForModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl shrink-0">
                {CLUB_ICONS[selectedClubForModal.name] || '🏛️'}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[#0F172A] text-base truncate">
                  {selectedClubForModal.name}
                </h4>
                <p className="text-xs text-[#6366F1] font-medium">{selectedClubForModal.tagline}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedClubForModal.college}</p>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                About the Community
              </h5>
              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                {selectedClubForModal.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-gray-100 bg-white">
                <span className="text-gray-400 block mb-0.5">Category</span>
                <span className="font-semibold text-gray-800">{selectedClubForModal.category}</span>
              </div>
              <div className="p-3 rounded-xl border border-gray-100 bg-white">
                <span className="text-gray-400 block mb-0.5">Active Members</span>
                <span className="font-semibold text-gray-800">
                  {selectedClubForModal.membersCount.toLocaleString()} Students
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setSelectedClubForModal(null)}>
                Close
              </Button>
              <Button
                variant={membershipMap[selectedClubForModal.id] ? 'outline' : 'primary'}
                onClick={() => toggleMembership(selectedClubForModal)}
              >
                {membershipMap[selectedClubForModal.id] ? 'Leave Club' : 'Join Club'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
