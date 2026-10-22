'use client';

import React, { useState } from 'react';
import { Search, UserPlus, MoreHorizontal, Shield, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Avatar, Modal } from '@/components/ui/index';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';

const MOCK_MEMBERS = [
  { id: 'm1', name: 'Ballaya', email: 'ballaya@example.com', role: 'President', joinedAt: '2024-08-01', active: true },
  { id: 'm2', name: 'Priya Nair', email: 'priya@example.com', role: 'Vice President', joinedAt: '2024-08-01', active: true },
  { id: 'm3', name: 'Arjun Rao', email: 'arjun@example.com', role: 'Tech Lead', joinedAt: '2024-09-15', active: true },
  { id: 'm4', name: 'Rhea Sharma', email: 'rhea@example.com', role: 'Design Lead', joinedAt: '2024-10-01', active: true },
  { id: 'm5', name: 'Karan Malik', email: 'karan@example.com', role: 'Member', joinedAt: '2025-01-10', active: true },
  { id: 'm6', name: 'Aditi P', email: 'aditi@example.com', role: 'Member', joinedAt: '2025-02-20', active: false },
  { id: 'm7', name: 'Dev Kumar', email: 'dev@example.com', role: 'Member', joinedAt: '2025-03-05', active: true },
  { id: 'm8', name: 'Neha Tomar', email: 'neha@example.com', role: 'Member', joinedAt: '2025-06-12', active: true },
];

export default function MembersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const filtered = MOCK_MEMBERS.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleBadge = (role: string) => {
    if (role === 'President') return <Badge variant="violet">{role}</Badge>;
    if (role === 'Vice President') return <Badge variant="blue">{role}</Badge>;
    if (role.includes('Lead')) return <Badge variant="teal">{role}</Badge>;
    return <Badge variant="gray">{role}</Badge>;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Members</h1>
          <p className="text-sm text-gray-500">Manage club members and roles.</p>
        </div>
        <Button size="sm" icon={<UserPlus className="w-4 h-4" />} onClick={() => setShowInvite(true)}>Invite Member</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-2xl font-black text-indigo-700" style={{ fontFamily: 'Poppins, sans-serif' }}>{MOCK_MEMBERS.length}</p>
          <p className="text-xs text-gray-500">Total Members</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-2xl font-black text-emerald-800" style={{ fontFamily: 'Poppins, sans-serif' }}>{MOCK_MEMBERS.filter(m => m.active).length}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-2xl font-black text-slate-500" style={{ fontFamily: 'Poppins, sans-serif' }}>{MOCK_MEMBERS.filter(m => !m.active).length}</p>
          <p className="text-xs text-gray-500">Inactive</p>
        </div>
      </div>

      <div className="flex gap-3 items-center mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#6366F1] transition-all" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Member</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Joined</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={m.name} size="sm" /><div><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-gray-400">{m.email}</p></div></div></td>
                <td className="px-4 py-3">{roleBadge(m.role)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(m.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                <td className="px-4 py-3"><Badge variant={m.active ? 'teal' : 'gray'}>{m.active ? 'Active' : 'Inactive'}</Badge></td>
                <td className="px-4 py-3"><button className="p-1 text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Member" size="sm">
        <div className="space-y-4">
          <Input label="Email address" type="email" placeholder="member@example.com" icon={<Mail className="w-4 h-4" />} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          <Button fullWidth onClick={() => { toast('Invitation sent! (Demo mode)', 'success'); setShowInvite(false); setInviteEmail(''); }}>Send Invitation</Button>
        </div>
      </Modal>
    </div>
  );
}
