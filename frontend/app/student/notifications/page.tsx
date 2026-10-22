'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Users,
  Trophy,
  Star,
  Megaphone,
  Check,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type Tab = 'all' | 'club' | 'event' | 'opportunity';

interface NotificationItem {
  id: string;
  type: Tab;
  title: string;
  summary: string;
  timeAgo: string;
  isNew?: boolean;
  unread: boolean;
  iconBg: string;
  iconColor: string;
  icon: React.ComponentType<{ className?: string }>;
  link?: string;
  section: 'Today' | 'Earlier';
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    type: 'event',
    title: 'Nexovate 2.0: The Engineer’s Pitch',
    summary: 'Registrations are now open! Be a part of the biggest idea pitch event at PSAIAC.',
    timeAgo: '2 hours ago',
    isNew: true,
    unread: true,
    iconBg: 'bg-[#FEF2F2]',
    iconColor: 'text-[#EF4444]',
    icon: Calendar,
    link: '/events/evt-1',
    section: 'Today',
  },
  {
    id: 'n-2',
    type: 'club',
    title: 'HARVEST Club Update',
    summary: 'New event announced: AgriTech Workshop Series. Check out the details and register.',
    timeAgo: '5 hours ago',
    isNew: true,
    unread: true,
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#3B82F6]',
    icon: Users,
    link: '/clubs/club-1',
    section: 'Today',
  },
  {
    id: 'n-4',
    type: 'event',
    title: 'Workshop: GenAI for Students',
    summary: 'Seats are filling fast. Don’t miss this hands-on workshop.',
    timeAgo: '1 day ago',
    isNew: false,
    unread: false,
    iconBg: 'bg-[#ECFDF5]',
    iconColor: 'text-[#10B981]',
    icon: Megaphone,
    link: '/student/events',
    section: 'Earlier',
  },
  {
    id: 'n-5',
    type: 'opportunity',
    title: 'Opportunity Alert',
    summary: 'Infosys InStep Springboard internship applications are now open.',
    timeAgo: '1 day ago',
    isNew: false,
    unread: false,
    iconBg: 'bg-[#FFFBEB]',
    iconColor: 'text-[#F59E0B]',
    icon: Trophy,
    link: '/student/discover',
    section: 'Earlier',
  },
  {
    id: 'n-6',
    type: 'club',
    title: 'You’re now a member!',
    summary: 'Welcome to the HARVEST AgriTech Innovation Club! Start exploring upcoming events and connect with members.',
    timeAgo: '2 days ago',
    isNew: false,
    unread: false,
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#3B82F6]',
    icon: Users,
    link: '/clubs/club-1',
    section: 'Earlier',
  },
  {
    id: 'n-7',
    type: 'event',
    title: 'Event Reminder',
    summary: 'Smart Campus Hackathon starts tomorrow at 10:00 AM.',
    timeAgo: '2 days ago',
    isNew: false,
    unread: false,
    iconBg: 'bg-[#EEF2FF]',
    iconColor: 'text-[#6366F1]',
    icon: Calendar,
    link: '/student/events',
    section: 'Earlier',
  },
  {
    id: 'n-8',
    type: 'club',
    title: 'New Club Recommendation',
    summary: 'Based on your interests, you might like the Robotics Club.',
    timeAgo: '3 days ago',
    isNew: false,
    unread: false,
    iconBg: 'bg-[#ECFDF5]',
    iconColor: 'text-[#10B981]',
    icon: Star,
    link: '/student/clubs',
    section: 'Earlier',
  },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>(NOTIFICATIONS);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false, isNew: false })));
  };

  const markSingleRead = (id: string, link?: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false, isNew: false } : n));
    if (link) router.push(link);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: notifications.filter(n => n.unread).length },
    { id: 'club', label: 'Club Updates', count: notifications.filter(n => n.type === 'club' && n.unread).length },
    { id: 'event', label: 'Event Updates', count: notifications.filter(n => n.type === 'event' && n.unread).length },
    { id: 'opportunity', label: 'Opportunities', count: notifications.filter(n => n.type === 'opportunity' && n.unread).length },
  ];

  const filtered = notifications.filter(n => (activeTab === 'all' ? true : n.type === activeTab));
  const todayItems = filtered.filter(n => n.section === 'Today');
  const earlierItems = filtered.filter(n => n.section === 'Earlier');

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stay up to date with what&apos;s happening on your campus.
          </p>
        </div>

        <button
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Check className="w-4 h-4 text-slate-500" />
          <span>Mark all as read</span>
        </button>
      </div>

      {/* ── SEGMENTED PILL FILTER TABS (MATCHES REFERENCE EXACTLY) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 scrollbar-none">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer',
                isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-transparent shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 rounded-full text-[10px] font-bold bg-[#EF4444] text-white">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── NOTIFICATION CARDS LIST ── */}
      <div className="space-y-6">
        {/* Today Section */}
        {todayItems.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Today
            </h2>
            <div className="space-y-3">
              {todayItems.map(item => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => markSingleRead(item.id, item.link)}
                    className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-slate-200 hover:shadow-xs p-4 flex items-center justify-between gap-4 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={cn('w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center', item.iconBg)}>
                        <IconComponent className={cn('w-5 h-5', item.iconColor)} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-sm text-[#0F172A] group-hover:text-[#4F46E5] transition-colors truncate">
                            {item.title}
                          </h3>
                          {item.isNew && (
                            <span className="shrink-0 text-[10px] font-bold bg-[#EF4444] text-white px-2 py-0.5 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-normal line-clamp-1 leading-normal">
                          {item.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400 font-normal">
                        {item.timeAgo}
                      </span>
                      {item.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Earlier Section */}
        {earlierItems.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Earlier
            </h2>
            <div className="space-y-3">
              {earlierItems.map(item => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => markSingleRead(item.id, item.link)}
                    className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-slate-200 hover:shadow-xs p-4 flex items-center justify-between gap-4 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={cn('w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center', item.iconBg)}>
                        <IconComponent className={cn('w-5 h-5', item.iconColor)} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-[#0F172A] group-hover:text-[#4F46E5] transition-colors truncate mb-0.5">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-normal line-clamp-1 leading-normal">
                          {item.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400 font-normal">
                        {item.timeAgo}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
