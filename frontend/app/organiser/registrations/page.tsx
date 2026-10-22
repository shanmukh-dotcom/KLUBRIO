'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, ClipboardList, ChevronRight, Calendar, CheckCircle, AlertCircle, MoreHorizontal } from 'lucide-react';
import { MOCK_EVENTS, MOCK_PARTICIPANTS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { Badge, Avatar } from '@/components/ui/index';
import { cn } from '@/lib/utils';

export default function RegistrationsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const registrations = MOCK_PARTICIPANTS.map((p, i) => ({
    ...p,
    eventTitle: MOCK_EVENTS[0].title,
    eventDate: MOCK_EVENTS[0].date,
    submittedAt: `2026-09-${String(10 - i).padStart(2, '0')}T14:30:00Z`,
    approvalStatus: i < 5 ? 'approved' : i < 6 ? 'pending' : 'approved',
  }));

  const filtered = registrations.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.registrationId.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && r.approvalStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Registrations</h1>
        <p className="text-sm text-gray-500">Manage event registrations and approvals.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Registrations', value: '128', color: 'text-indigo-700', bg: 'bg-indigo-50 border border-indigo-200' },
          { label: 'Approved', value: '120', color: 'text-emerald-800', bg: 'bg-emerald-50 border border-emerald-200' },
          { label: 'Pending', value: '5', color: 'text-amber-900', bg: 'bg-amber-50 border border-amber-200' },
          { label: 'Rejected', value: '3', color: 'text-rose-800', bg: 'bg-rose-50 border border-rose-200' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className={cn('text-2xl font-black', s.color)} style={{ fontFamily: 'Poppins, sans-serif' }}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#6366F1] transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#6366F1]">
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button size="sm" variant="outline">Export CSV</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Participant</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Reg. ID</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Event</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{r.registrationId}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{r.eventTitle}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.approvalStatus === 'approved' ? 'teal' : r.approvalStatus === 'pending' ? 'yellow' : 'red'}>
                      {r.approvalStatus === 'approved' ? 'Approved' : r.approvalStatus === 'pending' ? 'Pending' : 'Rejected'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost">View</Button>
                      <button className="p-1 text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12"><ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">No registrations found.</p></div>
        )}
      </div>
    </div>
  );
}
