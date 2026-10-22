'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Calendar, MapPin, Clock, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { MOCK_EVENTS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/index';
import { cn } from '@/lib/utils';

export default function OrganiserEventsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const events = MOCK_EVENTS.map((e, i) => ({
    ...e,
    status: i === 0 ? 'published' as const : i === 1 ? 'published' as const : i === 2 ? 'draft' as const : i === 3 ? 'completed' as const : 'published' as const,
  }));

  const filtered = events.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    return true;
  });

  const statusBadge = (status: string) => {
    if (status === 'published') return <Badge variant="teal">Published</Badge>;
    if (status === 'draft') return <Badge variant="yellow">Draft</Badge>;
    if (status === 'completed') return <Badge variant="gray">Completed</Badge>;
    return <Badge variant="red">Cancelled</Badge>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Events</h1>
          <p className="text-sm text-gray-500">Create and manage your club events.</p>
        </div>
        <Link href="/organiser/events/new">
          <Button size="sm" icon={<Plus className="w-4 h-4" />}>Create Event</Button>
        </Link>
      </div>

      <div className="flex gap-3 items-center mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#6366F1] transition-all" />
        </div>
        <div className="flex gap-2">
          {['all', 'published', 'draft', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all', statusFilter === s ? 'bg-[#6366F1]/10 text-[#6366F1]' : 'text-gray-500 hover:bg-gray-100')}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(event => {
          const d = new Date(event.date);
          return (
            <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                {/* Date */}
                <div className="shrink-0 w-14 text-center">
                  <span className="text-xs font-bold text-[#6366F1] uppercase">{d.toLocaleString('en', { month: 'short' })}</span>
                  <p className="text-2xl font-black text-[#0F172A] leading-none">{d.getDate()}</p>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[#0F172A] text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{event.title}</h3>
                    {statusBadge(event.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.venue}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.startTime}</span>
                    <span>{event.registeredCount} registered</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 relative">
                  <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />}>View</Button>
                  <Link href="/organiser/events/new">
                    <Button size="sm" variant="ghost" icon={<Edit className="w-4 h-4" />}>Edit</Button>
                  </Link>
                  <button
                    onClick={() => setOpenMenu(openMenu === event.id ? null : event.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {openMenu === event.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-36">
                      <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Duplicate</button>
                      <button className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-3 h-3" />Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No events found.</p>
            <Link href="/organiser/events/new"><Button size="sm" variant="outline" className="mt-3">Create your first event</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
