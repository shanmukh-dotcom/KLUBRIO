'use client';

import React, { useState } from 'react';
import { Search, MoreHorizontal, Download, Users } from 'lucide-react';
import { MOCK_PARTICIPANTS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { Badge, Avatar } from '@/components/ui/index';
import { cn } from '@/lib/utils';

export default function ParticipantsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = MOCK_PARTICIPANTS.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.registrationId.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Participants</h1>
          <p className="text-sm text-gray-500">View and manage all event participants.</p>
        </div>
        <Button size="sm" variant="outline" icon={<Download className="w-4 h-4" />}>Export</Button>
      </div>

      <div className="flex gap-3 items-center mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#6366F1] transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="checked-in">Checked In</option>
          <option value="not-checked-in">Not Checked In</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Reg. ID</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={p.name} size="sm" /><span className="text-sm font-medium text-[#0F172A]">{p.name}</span></div></td>
                <td className="px-4 py-3 text-sm text-gray-500">{p.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{p.registrationId}</td>
                <td className="px-4 py-3"><Badge variant={p.status === 'checked-in' ? 'teal' : 'red'}>{p.status === 'checked-in' ? 'Checked In' : 'Not Checked In'}</Badge></td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Button size="sm" variant="ghost">View</Button><button className="p-1 text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-4 h-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12"><Users className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">No participants found.</p></div>
        )}
      </div>
    </div>
  );
}
