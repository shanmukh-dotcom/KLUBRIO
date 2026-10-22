'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  QrCode,
  CheckCircle2,
  Clock,
  Users,
  Users2,
  Copy,
  Download,
  Share2,
  Search,
  Filter,
  Camera,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Check,
  Eye,
  Sparkles,
  UploadCloud,
  FileImage,
  Sliders,
  Maximize2,
  X,
  Volume2,
  RefreshCw,
  ArrowUpDown,
  Smartphone,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, Badge, Avatar, Modal, Toggle } from '@/components/ui/index';
import { MOCK_PARTICIPANTS, MOCK_EVENTS } from '@/mocks/data';
import type { Participant } from '@/types';
import { useToast } from '@/lib/toast-context';

interface TeamRegistration {
  id: string;
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  registrationId: string;
  memberCount: number;
  status: 'checked-in' | 'not-checked-in';
  checkedInMembers: number;
}

const MOCK_TEAMS: TeamRegistration[] = [
  {
    id: 't-1',
    teamName: 'AgroBots Alpha',
    leaderName: 'Rhea Sharma',
    leaderEmail: 'rhea@example.com',
    registrationId: 'TEAM-001',
    memberCount: 4,
    status: 'checked-in',
    checkedInMembers: 4,
  },
  {
    id: 't-2',
    teamName: 'HydroGreen',
    leaderName: 'Karan Malik',
    leaderEmail: 'karan@example.com',
    registrationId: 'TEAM-002',
    memberCount: 4,
    status: 'checked-in',
    checkedInMembers: 3,
  },
  {
    id: 't-3',
    teamName: 'TerraVibe Tech',
    leaderName: 'Aditi P',
    leaderEmail: 'aditi@example.com',
    registrationId: 'TEAM-003',
    memberCount: 3,
    status: 'not-checked-in',
    checkedInMembers: 0,
  },
  {
    id: 't-4',
    teamName: 'BioCircuit Squad',
    leaderName: 'Varun S',
    leaderEmail: 'varun@example.com',
    registrationId: 'TEAM-004',
    memberCount: 4,
    status: 'checked-in',
    checkedInMembers: 4,
  },
];

export default function AttendancePage() {
  const { toast } = useToast();

  // State
  const [selectedEventId, setSelectedEventId] = useState('evt-1');
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'generate' | 'scanner' | 'list' | 'poster'>('generate');
  const [registrationType, setRegistrationType] = useState<'individual' | 'team'>('individual');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked-in' | 'not-checked-in'>('all');

  // Participants & Teams data state (allows live check-in toggles)
  const [participants, setParticipants] = useState<Participant[]>(MOCK_PARTICIPANTS);
  const [teams, setTeams] = useState<TeamRegistration[]>(MOCK_TEAMS);

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualIdInput, setManualIdInput] = useState('');
  const [viewPassParticipant, setViewPassParticipant] = useState<Participant | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(true);

  // Poster generator state
  const [qrPosition, setQrPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'center-bottom'>('bottom-right');
  const [qrSize, setQrSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [posterUploaded, setPosterUploaded] = useState(false);

  // Active dots menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Current selected event
  const currentEvent = MOCK_EVENTS.find(e => e.id === selectedEventId) || MOCK_EVENTS[0];

  // Derived stats
  const totalRegistered = 128; // Total overall count for event
  const checkedInCount = 112;
  const notCheckedInCount = 16;
  const checkedInPercentage = Math.round((checkedInCount / totalRegistered) * 100 * 10) / 10;

  // Filtered participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.registrationId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ? true : p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [participants, searchQuery, statusFilter]);

  // Filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      const matchesSearch =
        t.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.leaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.registrationId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ? true : t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [teams, searchQuery, statusFilter]);

  // Actions
  const handleToggleCheckIn = (id: string) => {
    setParticipants(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextStatus = p.status === 'checked-in' ? 'not-checked-in' : 'checked-in';
          toast(
            nextStatus === 'checked-in'
              ? `Checked in ${p.name} (${p.registrationId})`
              : `Check-in reversed for ${p.name}`,
            nextStatus === 'checked-in' ? 'success' : 'info'
          );
          return {
            ...p,
            status: nextStatus,
            checkedInAt: nextStatus === 'checked-in' ? new Date().toISOString() : undefined,
          };
        }
        return p;
      })
    );
  };

  const handleToggleTeamCheckIn = (id: string) => {
    setTeams(prev =>
      prev.map(t => {
        if (t.id === id) {
          const nextStatus = t.status === 'checked-in' ? 'not-checked-in' : 'checked-in';
          toast(
            nextStatus === 'checked-in'
              ? `Checked in ${t.teamName} (${t.registrationId})`
              : `Team check-in reversed for ${t.teamName}`,
            nextStatus === 'checked-in' ? 'success' : 'info'
          );
          return {
            ...t,
            status: nextStatus,
            checkedInMembers: nextStatus === 'checked-in' ? t.memberCount : 0,
          };
        }
        return t;
      })
    );
  };

  const handleCopyLink = (text: string, label = 'Registration link') => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard!`, 'success');
  };

  const handleDownloadQr = () => {
    toast('Event Registration QR Code downloaded as PNG (300 DPI)', 'success');
  };

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualIdInput.trim().toUpperCase();
    if (!query) {
      toast('Please enter a Registration ID or Name', 'warning');
      return;
    }

    const matched = participants.find(
      p => p.registrationId.toUpperCase() === query || p.name.toUpperCase().includes(query)
    );

    if (matched) {
      setParticipants(prev =>
        prev.map(p => (p.id === matched.id ? { ...p, status: 'checked-in', checkedInAt: new Date().toISOString() } : p))
      );
      toast(`Successfully checked in ${matched.name} (${matched.registrationId})!`, 'success');
      setManualIdInput('');
      setManualModalOpen(false);
    } else {
      toast(`No participant found for "${manualIdInput}"`, 'error');
    }
  };

  const handleSimulateScan = (participant: Participant) => {
    setParticipants(prev =>
      prev.map(p => (p.id === participant.id ? { ...p, status: 'checked-in', checkedInAt: new Date().toISOString() } : p))
    );
    toast(`Scan Success: ${participant.name} verified!`, 'success');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Breadcrumb & Header Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Breadcrumbs + Title */}
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <Link href="/organiser/events" className="hover:text-[#6366F1] transition-colors">
                  Events
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-800 font-semibold truncate max-w-[240px] sm:max-w-none">
                  {currentEvent.title}
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                QR Codes & Attendance
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Generate QR codes, manage check-ins and track attendance in real time.
              </p>
            </div>

            {/* Right: Event Selector Dropdown */}
            <div className="flex items-center gap-3">
              <div className="w-full sm:w-64">
                <Select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  options={MOCK_EVENTS.map(evt => ({
                    value: evt.id,
                    label: evt.title,
                  }))}
                  className="bg-white border-slate-200 text-xs font-medium text-slate-800 shadow-sm"
                />
              </div>
              <Badge variant="teal" className="hidden sm:inline-flex py-1 px-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                Live Event
              </Badge>
            </div>
          </div>

          {/* 4 Stat Cards in a row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            {/* Total Registered */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Registered
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-2xl sm:text-3xl font-black text-[#0F172A]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {totalRegistered}
                </span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  +12.5%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Capacity: 150 participants</p>
            </div>

            {/* Checked In */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Checked In
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-2xl sm:text-3xl font-black text-emerald-600"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {checkedInCount}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  {checkedInPercentage}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Target attendance: 90%</p>
            </div>

            {/* Not Checked In */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Not Checked In
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-2xl sm:text-3xl font-black text-amber-600"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {notCheckedInCount}
                </span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                  {(100 - checkedInPercentage).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Pending arrival</p>
            </div>

            {/* Teams */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Teams
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-2xl sm:text-3xl font-black text-blue-600"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  4
                </span>
                <span className="text-xs font-medium text-slate-500">
                  (28 members)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Avg 7 members per team</p>
            </div>
          </div>

          {/* 4 Workflow Tab Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 pb-1 scrollbar-none">
            {[
              { id: 'generate', label: 'Generate QR Codes', icon: QrCode },
              { id: 'scanner', label: 'Check-In Scanner', icon: Camera },
              { id: 'list', label: 'Attendance List', icon: Users },
              { id: 'poster', label: 'Poster QR', icon: FileImage },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeWorkflowTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveWorkflowTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 shrink-0 cursor-pointer',
                    isActive
                      ? 'bg-[#EEF2FF] text-[#4F46E5] border border-transparent shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Section 4 & 5 Strip: Quick Check-in Bar & Attendance Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 4: Live Check-In Action Card */}
          <div className="lg:col-span-1 bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#6366F1]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Section 4 · Live Check-In
                </span>
                <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                  Ready to scan
                </span>
              </div>
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Instant Entry Verification
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Use your device camera or external barcode scanner to check attendees in under a second.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row gap-2.5 mt-6">
              <Button
                variant="primary"
                size="md"
                className="flex-1 text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25"
                icon={<Camera className="w-4 h-4" />}
                onClick={() => setScannerOpen(true)}
              >
                Open Scanner
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="flex-1 text-xs sm:text-sm font-semibold bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setManualModalOpen(true)}
              >
                Enter ID Manually
              </Button>
            </div>
          </div>

          {/* Section 5: Attendance Summary */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                    Section 5 · Attendance Summary
                  </span>
                  <h3
                    className="text-lg font-bold text-[#0F172A] mt-0.5"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Check-in Milestone Tracker
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                    {checkedInCount} / {totalRegistered}
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Checked In ({checkedInPercentage}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-[#10B981] to-[#3B82F6] rounded-full transition-all duration-700 relative"
                    style={{ width: `${checkedInPercentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-100 text-center">
              <div className="p-2 rounded-xl bg-slate-50">
                <span className="text-[11px] font-medium text-slate-400 block">Peak Velocity</span>
                <span className="text-sm font-bold text-[#0F172A]">38 scans/10m</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50">
                <span className="text-[11px] font-medium text-slate-400 block">Avg Scan Speed</span>
                <span className="text-sm font-bold text-emerald-600">&lt; 0.6s</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50">
                <span className="text-[11px] font-medium text-slate-400 block">Remaining Seats</span>
                <span className="text-sm font-bold text-amber-600">
                  {totalRegistered - checkedInCount} left
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Event Registration QR Code */}
        {(activeWorkflowTab === 'generate' || activeWorkflowTab === 'poster') && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                  Section 1 · Event Registration QR Code
                </span>
                <h2
                  className="text-xl font-bold text-[#0F172A] mt-1"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Direct Event Registration Link & QR
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Display this QR code at reception desks, social media banners, or share the direct link.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={() =>
                    handleCopyLink(
                      `https://klubrio.in/events/${selectedEventId}/register`,
                      'Registration Link'
                    )
                  }
                >
                  Copy Link
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={handleDownloadQr}
                >
                  Download QR Code
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* QR Code Placeholder Graphic */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div className="relative p-5 bg-white border-2 border-slate-200 rounded-3xl shadow-lg hover:shadow-xl transition-all group">
                  {/* Outer corner scanner brackets */}
                  <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-[#6366F1] rounded-tl" />
                  <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-[#6366F1] rounded-tr" />
                  <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-[#10B981] rounded-bl" />
                  <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-[#10B981] rounded-br" />

                  {/* High Quality SVG QR Code Representation */}
                  <svg
                    width="190"
                    height="190"
                    viewBox="0 0 140 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="rounded-xl"
                  >
                    <rect width="140" height="140" fill="white" />
                    {/* Finder 1 Top Left */}
                    <rect x="10" y="10" width="35" height="35" rx="6" fill="#0F172A" />
                    <rect x="17" y="17" width="21" height="21" rx="4" fill="white" />
                    <rect x="23" y="23" width="9" height="9" rx="2" fill="#6366F1" />

                    {/* Finder 2 Top Right */}
                    <rect x="95" y="10" width="35" height="35" rx="6" fill="#0F172A" />
                    <rect x="102" y="17" width="21" height="21" rx="4" fill="white" />
                    <rect x="108" y="23" width="9" height="9" rx="2" fill="#6366F1" />

                    {/* Finder 3 Bottom Left */}
                    <rect x="10" y="95" width="35" height="35" rx="6" fill="#0F172A" />
                    <rect x="17" y="102" width="21" height="21" rx="4" fill="white" />
                    <rect x="23" y="108" width="9" height="9" rx="2" fill="#10B981" />

                    {/* QR Matrix Elements */}
                    <rect x="52" y="12" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="62" y="12" width="6" height="6" rx="1.5" fill="#3B82F6" />
                    <rect x="72" y="12" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="82" y="12" width="6" height="6" rx="1.5" fill="#0F172A" />

                    <rect x="52" y="22" width="6" height="6" rx="1.5" fill="#6366F1" />
                    <rect x="72" y="22" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="82" y="22" width="6" height="6" rx="1.5" fill="#0F172A" />

                    <rect x="52" y="32" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="62" y="32" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="82" y="32" width="6" height="6" rx="1.5" fill="#6366F1" />

                    <rect x="12" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="22" y="52" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="32" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="42" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="52" y="52" width="6" height="6" rx="1.5" fill="#6366F1" />
                    <rect x="62" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="72" y="52" width="6" height="6" rx="1.5" fill="#3B82F6" />
                    <rect x="82" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="92" y="52" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="102" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="122" y="52" width="6" height="6" rx="1.5" fill="#0F172A" />

                    <rect x="12" y="62" width="6" height="6" rx="1.5" fill="#6366F1" />
                    <rect x="32" y="62" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="52" y="62" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="72" y="62" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="92" y="62" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="112" y="62" width="6" height="6" rx="1.5" fill="#6366F1" />

                    <rect x="12" y="72" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="22" y="72" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="42" y="72" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="62" y="72" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="82" y="72" width="6" height="6" rx="1.5" fill="#3B82F6" />
                    <rect x="102" y="72" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="122" y="72" width="6" height="6" rx="1.5" fill="#10B981" />

                    {/* Center badge */}
                    <rect x="55" y="55" width="30" height="30" rx="8" fill="#0F172A" />
                    <rect x="58" y="58" width="24" height="24" rx="6" fill="#6366F1" />
                    <path
                      d="M66 70L69 74L75 66"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Bottom right patterns */}
                    <rect x="52" y="95" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="62" y="95" width="6" height="6" rx="1.5" fill="#6366F1" />
                    <rect x="72" y="95" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="82" y="95" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="92" y="95" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="102" y="95" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="112" y="95" width="6" height="6" rx="1.5" fill="#3B82F6" />
                    <rect x="122" y="95" width="6" height="6" rx="1.5" fill="#0F172A" />

                    <rect x="62" y="105" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="72" y="105" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="92" y="105" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="112" y="105" width="6" height="6" rx="1.5" fill="#6366F1" />
                    <rect x="122" y="105" width="6" height="6" rx="1.5" fill="#0F172A" />

                    <rect x="52" y="115" width="6" height="6" rx="1.5" fill="#6366F1" />
                    <rect x="72" y="115" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="82" y="115" width="6" height="6" rx="1.5" fill="#3B82F6" />
                    <rect x="102" y="115" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="122" y="115" width="6" height="6" rx="1.5" fill="#10B981" />

                    <rect x="52" y="125" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="62" y="125" width="6" height="6" rx="1.5" fill="#10B981" />
                    <rect x="92" y="125" width="6" height="6" rx="1.5" fill="#0F172A" />
                    <rect x="112" y="125" width="6" height="6" rx="1.5" fill="#0F172A" />
                  </svg>
                </div>
                <span className="text-xs text-slate-400 mt-2 font-mono">Scan with any mobile camera</span>
              </div>

              {/* Registration Link and Options */}
              <div className="md:col-span-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Public Event Registration URL
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        readOnly
                        value={`https://klubrio.in/events/${selectedEventId}/register`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-700 select-all focus:outline-none"
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Copy className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleCopyLink(
                          `https://klubrio.in/events/${selectedEventId}/register`,
                          'Registration link'
                        )
                      }
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                    <h4 className="text-xs font-bold text-slate-800">High-Resolution Vector (SVG)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Best for printing flyers, brochures, roll-up banners, and standees.
                    </p>
                    <button
                      onClick={() => toast('Vector SVG downloaded', 'success')}
                      className="text-xs font-semibold text-[#6366F1] hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      Download SVG <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                    <h4 className="text-xs font-bold text-slate-800">Dynamic QR Tracking</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Automatically logs referrers, scan timestamps, and device platform.
                    </p>
                    <span className="text-xs font-semibold text-emerald-600 mt-2 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Active & Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Participant QR Passes */}
        {(activeWorkflowTab === 'list' || activeWorkflowTab === 'generate') && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                  Section 2 · Participant QR Passes
                </span>
                <h2
                  className="text-xl font-bold text-[#0F172A] mt-1"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Participant QR Passes & Check-In Roster
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  View issued QR passes, update check-in status manually, and inspect individual pass details.
                </p>
              </div>

              {/* Sub-tabs: Individual / Team registrations */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setRegistrationType('individual')}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                    registrationType === 'individual'
                      ? 'bg-white text-[#6366F1] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  Individual ({participants.length})
                </button>
                <button
                  onClick={() => setRegistrationType('team')}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                    registrationType === 'team'
                      ? 'bg-white text-[#6366F1] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  Team Registrations ({teams.length})
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    registrationType === 'individual'
                      ? 'Search by name, email or REG ID...'
                      : 'Search by team name or leader...'
                  }
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="w-full sm:w-48">
                <Select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'checked-in', label: 'Checked In' },
                    { value: 'not-checked-in', label: 'Not Checked In' },
                  ]}
                  className="bg-slate-50 border-slate-200 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Table Area */}
            {registrationType === 'individual' ? (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">Registration ID</th>
                      <th className="py-3 px-4 text-center">QR Pass</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipants.map(participant => {
                      const isCheckedIn = participant.status === 'checked-in';
                      return (
                        <tr
                          key={participant.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Name + Avatar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={participant.name} size="sm" />
                              <div>
                                <p className="font-semibold text-slate-800 leading-none">
                                  {participant.name}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{participant.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Registration ID */}
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                              {participant.registrationId}
                            </span>
                          </td>

                          {/* QR Pass Small Icon */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setViewPassParticipant(participant)}
                              className="p-1.5 rounded-lg text-[#6366F1] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 transition-colors inline-flex items-center justify-center"
                              title="View QR Pass"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4">
                            {isCheckedIn ? (
                              <Badge
                                variant="teal"
                                className="inline-flex items-center gap-1.5 font-bold"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Checked In
                              </Badge>
                            ) : (
                              <Badge
                                variant="red"
                                className="inline-flex items-center gap-1.5 font-bold"
                              >
                                <Clock className="w-3.5 h-3.5 text-rose-500" />
                                Not Checked In
                              </Badge>
                            )}
                            {participant.checkedInAt && (
                              <span className="block text-[10px] text-slate-400 mt-0.5" suppressHydrationWarning>
                                at {new Date(participant.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant={isCheckedIn ? 'outline' : 'primary'}
                                className={cn(
                                  'text-xs py-1 px-3 h-8',
                                  isCheckedIn && 'border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300'
                                )}
                                onClick={() => handleToggleCheckIn(participant.id)}
                              >
                                {isCheckedIn ? 'Undo Check-in' : 'Check In'}
                              </Button>

                              <button
                                onClick={() => setViewPassParticipant(participant)}
                                className="p-1.5 text-slate-400 hover:text-[#6366F1] hover:bg-slate-100 rounded-lg transition-colors"
                                title="View Pass"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setActiveMenuId(activeMenuId === participant.id ? null : participant.id)
                                  }
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {activeMenuId === participant.id && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-left">
                                    <button
                                      onClick={() => {
                                        handleCopyLink(
                                          `https://klubrio.in/pass/${participant.registrationId}`,
                                          'Pass link'
                                        );
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                      Copy Pass Link
                                    </button>
                                    <button
                                      onClick={() => {
                                        toast(`Pass emailed to ${participant.email}`, 'success');
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Share2 className="w-3.5 h-3.5 text-slate-400" />
                                      Resend via Email
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredParticipants.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No participants found matching your criteria.
                  </div>
                )}
              </div>
            ) : (
              /* Team Registrations Table */
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Team Name</th>
                      <th className="py-3 px-4">Team Leader</th>
                      <th className="py-3 px-4">Registration ID</th>
                      <th className="py-3 px-4">Check-in Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeams.map(team => {
                      const isFull = team.checkedInMembers === team.memberCount;
                      return (
                        <tr key={team.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                {team.teamName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800">{team.teamName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-700">{team.leaderName}</p>
                            <p className="text-xs text-slate-400">{team.leaderEmail}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                              {team.registrationId}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={isFull ? 'teal' : 'yellow'} className="font-bold">
                              {team.checkedInMembers} of {team.memberCount} checked in
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant={isFull ? 'outline' : 'primary'}
                              className="text-xs py-1 px-3 h-8"
                              onClick={() => handleToggleTeamCheckIn(team.id)}
                            >
                              {isFull ? 'Undo Team' : 'Check In Team'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 text-xs text-slate-500">
              <p>
                Showing <span className="font-semibold text-slate-800">1 to {filteredParticipants.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{totalRegistered}</span> registered participants
              </p>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" disabled className="px-3 py-1 text-xs">
                  Previous
                </Button>
                <button className="w-7 h-7 rounded-lg bg-[#6366F1] text-white font-bold text-xs flex items-center justify-center">
                  1
                </button>
                <button className="w-7 h-7 rounded-lg text-slate-600 hover:bg-slate-100 text-xs flex items-center justify-center">
                  2
                </button>
                <button className="w-7 h-7 rounded-lg text-slate-600 hover:bg-slate-100 text-xs flex items-center justify-center">
                  3
                </button>
                <span className="px-1 text-slate-400">…</span>
                <button className="w-7 h-7 rounded-lg text-slate-600 hover:bg-slate-100 text-xs flex items-center justify-center">
                  16
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  onClick={() => toast('Navigating to next page', 'info')}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Add QR Code to Your Poster */}
        {(activeWorkflowTab === 'poster' || activeWorkflowTab === 'generate') && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                  Section 3 · Add QR Code to Your Poster
                </span>
                <h2
                  className="text-xl font-bold text-[#0F172A] mt-1"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Smart Poster QR Overlay Studio
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Overlay dynamic registration QR codes directly onto your event marketing creative.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Sliders className="w-3.5 h-3.5" />}
                  onClick={() => toast('Poster position settings opened', 'info')}
                >
                  Edit Position
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => toast('Updated Poster with QR downloaded (PDF Print Ready)', 'success')}
                >
                  Download Updated Poster
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Upload & Controls Column */}
              <div className="lg:col-span-5 space-y-5">
                {/* Upload Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Upload Event Poster Graphic
                  </label>
                  <label className="border-2 border-dashed border-slate-300 hover:border-[#6366F1] bg-slate-50/60 hover:bg-indigo-50/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, application/pdf"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setPosterUploaded(true);
                          toast(`Loaded ${e.target.files[0].name}`, 'success');
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 group-hover:border-[#6366F1] group-hover:scale-105 transition-all flex items-center justify-center text-[#6366F1] mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">
                      {posterUploaded ? 'Replace Uploaded Poster' : 'Upload Poster'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      PNG, JPG or PDF (max 10 MB)
                    </span>
                    <span className="mt-3 text-[11px] font-semibold text-[#6366F1] bg-[#6366F1]/10 px-2.5 py-1 rounded-full">
                      Drag & Drop or Browse File
                    </span>
                  </label>
                </div>

                {/* QR Placement Controls */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    QR Overlay Position
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'bottom-right', label: 'Bottom Right' },
                      { id: 'bottom-left', label: 'Bottom Left' },
                      { id: 'top-right', label: 'Top Right' },
                      { id: 'center-bottom', label: 'Center Bottom' },
                    ].map(pos => (
                      <button
                        key={pos.id}
                        onClick={() => setQrPosition(pos.id as any)}
                        className={cn(
                          'py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all',
                          qrPosition === pos.id
                            ? 'bg-[#6366F1] text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                        )}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">
                      QR Code Size
                    </span>
                    <div className="flex gap-2">
                      {(['sm', 'md', 'lg'] as const).map(size => (
                        <button
                          key={size}
                          onClick={() => setQrSize(size)}
                          className={cn(
                            'flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all',
                            qrSize === size
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          )}
                        >
                          {size === 'sm' ? 'Small (20%)' : size === 'md' ? 'Medium (28%)' : 'Large (36%)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Poster Preview Area */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="relative w-full max-w-md aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col justify-between p-6">
                  {/* Poster Background Graphic Simulation */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1E1B4B] via-[#0F172A] to-[#042F2E] opacity-95" />
                  <div className="absolute -top-20 -left-20 w-60 h-60 bg-[#6366F1]/30 rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-[#10B981]/30 rounded-full blur-3xl" />

                  {/* Header content on poster */}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        HARVEST PRESENTS
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Presidency University</span>
                    </div>
                    <h3
                      className="text-2xl sm:text-3xl font-black text-white mt-4 leading-tight"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      NEXOVATE 2.0
                    </h3>
                    <p className="text-xs text-indigo-200 font-semibold uppercase tracking-wider">
                      The Engineer&apos;s Pitch Competition
                    </p>
                  </div>

                  {/* Mid poster content */}
                  <div className="relative z-10 text-xs text-slate-300 space-y-1 my-auto">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">PRIZE POOL</p>
                    <p className="text-xl font-black text-emerald-400">₹ 50,000 INR</p>
                    <p className="text-[11px] text-slate-300">September 11, 2026 · Seminar Hall 3</p>
                  </div>

                  {/* Bottom Strip with Interactive QR Overlay */}
                  <div className="relative z-10 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Register Online</p>
                      <p className="text-xs font-mono text-emerald-400">klubrio.in/nexovate</p>
                    </div>

                    {/* Placed QR Overlay based on state */}
                    <div
                      className={cn(
                        'bg-white p-2 rounded-xl shadow-2xl border-2 border-white transition-all duration-300',
                        qrSize === 'sm' ? 'w-20 h-20' : qrSize === 'md' ? 'w-24 h-24' : 'w-28 h-28'
                      )}
                    >
                      <div className="w-full h-full bg-slate-900 rounded-lg flex flex-col items-center justify-center text-center p-1 relative overflow-hidden">
                        <QrCode className="w-full h-full text-white" />
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-500 text-[7px] font-black text-white py-0.2 uppercase tracking-tighter">
                          SCAN ME
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-400 mt-3 text-center">
                  Live Poster Render Preview · Ready for Print & Instagram Story
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Live Scanner Viewport Modal */}
      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Check-In Scanner Viewfinder"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center border-2 border-slate-700 shadow-2xl">
            {/* Viewfinder Video Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Simulated camera feed / scanning grid */}
              <div className="relative w-64 h-64 border-2 border-white/60 rounded-3xl flex items-center justify-center">
                {/* 4 corner accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Animated Laser Scanning Line */}
                <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-bounce" />

                <div className="text-center px-4">
                  <Camera className="w-10 h-10 text-white/50 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-white/80 font-medium">
                    Point attendee QR code inside frame
                  </p>
                </div>
              </div>
            </div>

            {/* Top Toolbar */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between text-white text-xs z-10">
              <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Front Camera (HD 1080p)
              </span>
              <button
                onClick={() => toast('Camera switched', 'info')}
                className="bg-black/60 hover:bg-black/80 px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Switch Camera
              </button>
            </div>
          </div>

          {/* Quick Mock Scans to test scanner interactivity */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Simulate Instant Attendee Scan:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {participants.slice(0, 4).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSimulateScan(p)}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-[#6366F1] bg-slate-50 hover:bg-indigo-50/30 text-left transition-all"
                >
                  <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[11px] font-mono text-slate-500">{p.registrationId}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setScannerOpen(false)}>
              Close Scanner
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Manual Check-In Modal */}
      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Manual ID Check-In"
        size="md"
      >
        <form onSubmit={handleManualCheckIn} className="space-y-4">
          <p className="text-xs text-slate-500">
            Search by attendee Registration ID (e.g. <span className="font-mono text-slate-700">REG-003</span>) or attendee full name.
          </p>

          <Input
            label="Registration ID or Name"
            placeholder="e.g. REG-003 or Aditi P"
            value={manualIdInput}
            onChange={e => setManualIdInput(e.target.value)}
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setManualModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Verify & Check In
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Participant QR Pass Preview */}
      <Modal
        open={!!viewPassParticipant}
        onClose={() => setViewPassParticipant(null)}
        title="Participant QR Pass"
        size="md"
      >
        {viewPassParticipant && (
          <div className="space-y-5 text-center">
            {/* Pass Graphic Card */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden text-left border border-indigo-900/50">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    KLUBRIO OFFICIAL PASS
                  </span>
                  <h4 className="text-base font-bold text-white leading-tight">
                    {currentEvent.title}
                  </h4>
                </div>
                <Badge
                  variant={viewPassParticipant.status === 'checked-in' ? 'teal' : 'yellow'}
                  className="font-bold text-[10px]"
                >
                  {viewPassParticipant.status === 'checked-in' ? 'Checked In' : 'Valid Pass'}
                </Badge>
              </div>

              <div className="flex items-center gap-4">
                {/* QR code on pass */}
                <div className="bg-white p-2 rounded-xl shrink-0 shadow-lg">
                  <QrCode className="w-20 h-20 text-slate-900" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Attendee Name</p>
                  <p className="text-lg font-bold text-white">{viewPassParticipant.name}</p>
                  <p className="text-xs text-slate-300 font-mono">
                    {viewPassParticipant.registrationId}
                  </p>
                  <p className="text-[11px] text-indigo-300">Presidency University</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>Date: {formatDate(currentEvent.date)}</span>
                <span>Venue: {currentEvent.venue}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={() => toast('Participant pass saved to PDF', 'success')}
              >
                Download PDF
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Check className="w-3.5 h-3.5" />}
                onClick={() => {
                  handleToggleCheckIn(viewPassParticipant.id);
                  setViewPassParticipant(null);
                }}
              >
                {viewPassParticipant.status === 'checked-in' ? 'Undo Check In' : 'Confirm Check-In'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
