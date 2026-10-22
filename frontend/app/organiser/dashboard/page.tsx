'use client';

import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  ClipboardList,
  Users,
  Award,
  Plus,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Mail,
  QrCode,
  ShieldCheck,
  ChevronRight,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/index';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { MOCK_CLUBS } from '@/mocks/data';
import { cn } from '@/lib/utils';

export default function OrganiserDashboardPage() {
  const { user } = useAuth();

  // Club details
  const club = MOCK_CLUBS.find((c) => c.name === 'HARVEST') || MOCK_CLUBS[0];

  // Stats data
  const stats = [
    {
      label: 'Total Events',
      value: '14',
      sublabel: '3 this semester',
      trend: '+2 upcoming',
      icon: Calendar,
      iconColor: 'text-[#4F46E5]',
      iconBg: 'bg-[#EEF2FF]',
      borderColor: 'border-slate-200/80 hover:border-indigo-300',
      href: '/organiser/events',
    },
    {
      label: 'Total Registrations',
      value: '580',
      sublabel: 'Across all club events',
      trend: '+18% this month',
      icon: ClipboardList,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      borderColor: 'border-slate-200/80 hover:border-blue-300',
      href: '/organiser/registrations',
    },
    {
      label: 'Active Members',
      value: '2.5K',
      sublabel: 'Followers & members',
      trend: '+120 new this week',
      icon: Users,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      borderColor: 'border-slate-200/80 hover:border-emerald-300',
      href: '/organiser/members',
    },
    {
      label: 'Certificates Issued',
      value: '340',
      sublabel: 'Tamper-proof digital certs',
      trend: '98.5% claimed',
      icon: Award,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      borderColor: 'border-slate-200/80 hover:border-amber-300',
      href: '/organiser/certificates',
    },
  ];

  // Quick action shortcuts
  const quickActions = [
    {
      title: 'Create Event',
      desc: 'Set up forms, schedule & rules',
      icon: Calendar,
      color: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
      href: '/organiser/events/new',
      accent: 'group-hover:border-indigo-400',
    },
    {
      title: 'Manage Registrations',
      desc: 'Review signups & export CSV',
      icon: ClipboardList,
      color: 'bg-blue-100 text-blue-700 border border-blue-200',
      href: '/organiser/registrations',
      accent: 'group-hover:border-blue-400',
    },
    {
      title: 'Generate Certificates',
      desc: 'Batch issue verifiable credentials',
      icon: Award,
      color: 'bg-amber-100 text-amber-800 border border-amber-200',
      href: '/organiser/certificates',
      accent: 'group-hover:border-amber-400',
    },
    {
      title: 'Send Emails',
      desc: 'Blast updates, reminders & surveys',
      icon: Mail,
      color: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      href: '/organiser/emails',
      accent: 'group-hover:border-emerald-400',
    },
  ];

  // Recent Events
  const recentEvents = [
    {
      id: 'evt-1',
      title: "Nexovate 2.0: The Engineer's Pitch",
      date: 'Sep 11, 2026',
      time: '4:00 PM – 7:00 PM',
      venue: 'E Block, Seminar Hall 3',
      registered: 128,
      capacity: 150,
      status: 'Published',
      statusVariant: 'teal' as const,
      category: 'Innovation Pitch',
      actions: [
        { label: 'Manage', href: '/organiser/registrations' },
        { label: 'QR Scan', href: '/organiser/attendance' },
      ],
    },
    {
      id: 'evt-2',
      title: 'AgriTech Workshop Series',
      date: 'Oct 18, 2026',
      time: '10:00 AM – 1:00 PM',
      venue: 'E Block, Seminar Hall 2',
      registered: 72,
      capacity: 100,
      status: 'Published',
      statusVariant: 'teal' as const,
      category: 'Hands-on Workshop',
      actions: [
        { label: 'Manage', href: '/organiser/registrations' },
        { label: 'Certificates', href: '/organiser/certificates' },
      ],
    },
    {
      id: 'evt-3',
      title: 'Smart Precision Farming Hackathon',
      date: 'Nov 15, 2026',
      time: '9:00 AM – 6:00 PM',
      venue: 'Innovation Hub, Block D',
      registered: 0,
      capacity: 120,
      status: 'Draft',
      statusVariant: 'yellow' as const,
      category: '24hr Hackathon',
      actions: [
        { label: 'Edit Draft', href: '/organiser/events/new' },
        { label: 'Publish', href: '/organiser/events/new' },
      ],
    },
    {
      id: 'evt-4',
      title: 'Sustainable Agriculture Summit 2026',
      date: 'Aug 25, 2026',
      time: 'Full Day Event',
      venue: 'Main University Auditorium',
      registered: 145,
      capacity: 150,
      status: 'Completed',
      statusVariant: 'blue' as const,
      category: 'Conference',
      actions: [
        { label: 'Attendance', href: '/organiser/attendance' },
        { label: 'Certificates', href: '/organiser/certificates' },
      ],
    },
  ];

  // Activity Feed entries
  const recentActivities = [
    {
      id: 'act-1',
      actor: 'Rhea Sharma',
      avatar: undefined,
      action: 'checked in via QR code for',
      target: "Nexovate 2.0: The Engineer's Pitch",
      time: '4 mins ago',
      icon: QrCode,
      iconColor: 'text-[#10B981] bg-emerald-50',
    },
    {
      id: 'act-2',
      actor: 'Karan Malik',
      avatar: undefined,
      action: 'registered for',
      target: 'AgriTech Workshop Series',
      time: '22 mins ago',
      icon: ClipboardList,
      iconColor: 'text-[#3B82F6] bg-blue-50',
    },
    {
      id: 'act-3',
      actor: 'Automated Campaign',
      avatar: undefined,
      action: 'sent reminder email to',
      target: '112 registered participants',
      time: '2 hours ago',
      icon: Mail,
      iconColor: 'text-[#6366F1] bg-indigo-50',
    },
    {
      id: 'act-4',
      actor: 'System Admin',
      avatar: undefined,
      action: 'generated 340 certificates for',
      target: "Nexovate 2.0: The Engineer's Pitch",
      time: '4 hours ago',
      icon: Award,
      iconColor: 'text-amber-600 bg-amber-50',
    },
    {
      id: 'act-5',
      actor: 'Aditi P',
      avatar: undefined,
      action: 'joined as a new member of',
      target: 'HARVEST AgriTech Innovation Club',
      time: '1 day ago',
      icon: Users,
      iconColor: 'text-purple-600 bg-purple-50',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* 1. Welcome Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Presidency University
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-bold text-slate-600">
              Verified Club Workspace
            </span>
          </div>

          <h1
            className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Welcome back, {club.name} Organisers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {club.tagline} · Hybrid AI & Robotics for Vitality Enhancement and Sustainable Transformation
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/organiser/events/new">
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Create Event
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className="group">
              <div
                className={cn(
                  'bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs hover:shadow-md transition-all duration-200 group-hover:-translate-y-0.5 relative overflow-hidden',
                  stat.borderColor
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <div className={cn('p-2 rounded-xl transition-colors', stat.iconBg)}>
                    <Icon className={cn('w-5 h-5', stat.iconColor)} />
                  </div>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className="text-3xl font-bold text-[#0F172A] tracking-tight"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {stat.value}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                    {stat.trend}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate">{stat.sublabel}</span>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-[#6366F1] transition-colors shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 3. Quick Actions Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2
              className="text-base font-bold text-[#0F172A] tracking-tight"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Quick Actions
            </h2>
            <p className="text-xs text-gray-500">Direct shortcuts to common organiser workflows</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href} className="group">
                <div
                  className={cn(
                    'bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs hover:shadow-md transition-all duration-200 group-hover:-translate-y-0.5 flex flex-col justify-between h-full',
                    action.accent
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2.5 rounded-xl shrink-0', action.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-sm font-bold text-[#0F172A] group-hover:text-[#6366F1] transition-colors leading-tight"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {action.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-normal line-clamp-2">
                        {action.desc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-gray-50 flex items-center justify-between text-xs font-medium text-gray-400 group-hover:text-[#6366F1] transition-colors">
                    <span>Open tool</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 4. Two-Column Layout: Recent Events & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Recent Events List (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-bold text-[#0F172A] tracking-tight"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Recent Events
              </h2>
              <p className="text-xs text-gray-500">Track registrations and live status for current events</p>
            </div>
            <Link
              href="/organiser/events"
              className="text-xs font-semibold text-[#6366F1] hover:underline flex items-center gap-1"
            >
              View all 14 events
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentEvents.map((evt) => {
              const fillPercent =
                evt.capacity > 0 ? Math.round((evt.registered / evt.capacity) * 100) : 0;

              return (
                <div
                  key={evt.id}
                  className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={evt.statusVariant}>{evt.status}</Badge>
                        <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                          {evt.category}
                        </span>
                      </div>
                      <h3
                        className="text-base font-bold text-[#0F172A] leading-snug hover:text-[#6366F1] transition-colors"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {evt.title}
                      </h3>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      {evt.actions.map((act) => (
                        <Link key={act.label} href={act.href}>
                          <button className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:border-[#6366F1] hover:text-[#6366F1] bg-white transition-all shadow-2xs">
                            {act.label}
                          </button>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-3.5 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{evt.date} · {evt.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                    </div>
                  </div>

                  {/* Registrations Progress */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-600">
                        Registrations: <strong className="text-[#0F172A]">{evt.registered}</strong> / {evt.capacity}
                      </span>
                      <span className="font-semibold text-gray-500">{fillPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          fillPercent >= 80
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : fillPercent > 0
                            ? 'bg-gradient-to-r from-[#6366F1] to-[#3B82F6]'
                            : 'bg-gray-200'
                        )}
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Activity Feed & Verification Highlights (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Activity Feed Box */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#6366F1]" />
                <h2
                  className="text-base font-bold text-[#0F172A] tracking-tight"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Recent Activity
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed
              </span>
            </div>

            <div className="mt-3 divide-y divide-gray-50">
              {recentActivities.map((act) => {
                const Icon = act.icon;
                return (
                  <div key={act.id} className="py-3 flex items-start gap-3">
                    <div className={cn('p-2 rounded-xl shrink-0 mt-0.5', act.iconColor)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 leading-snug">
                        <strong className="text-[#0F172A] font-semibold">{act.actor}</strong>{' '}
                        {act.action}{' '}
                        <span className="font-medium text-[#6366F1]">{act.target}</span>
                      </p>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">{act.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 text-center">
              <Link
                href="/organiser/participants"
                className="text-xs font-semibold text-[#6366F1] hover:underline"
              >
                View all participant logs & check-ins
              </Link>
            </div>
          </div>

          {/* Verification & Club Health Widget */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 rounded-2xl border border-indigo-100/80 p-5 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Club Status
                </span>
                <h3
                  className="text-sm font-bold text-[#0F172A] mt-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  HARVEST Innovation Wing
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Official Club of Presidency University. All digital certificates issued are cryptographically signed with unique QR verification codes.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-indigo-100/60 text-xs">
              <div className="bg-white/80 border border-gray-100 rounded-xl p-2.5">
                <span className="text-gray-400 block text-[11px]">Avg Check-in Rate</span>
                <span className="text-base font-bold text-[#0F172A]">86.4%</span>
              </div>
              <div className="bg-white/80 border border-gray-100 rounded-xl p-2.5">
                <span className="text-gray-400 block text-[11px]">Verification SLA</span>
                <span className="text-base font-bold text-[#10B981]">Instant QR</span>
              </div>
            </div>

            <div className="mt-4">
              <Link href="/organiser/verification" className="w-full inline-block">
                <button className="w-full py-2 text-xs font-semibold text-[#6366F1] bg-white border border-[#6366F1]/30 hover:bg-[#6366F1]/10 rounded-xl transition-all shadow-2xs">
                  Manage Verification Keys & Badges →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
