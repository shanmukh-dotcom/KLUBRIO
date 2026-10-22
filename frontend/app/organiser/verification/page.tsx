'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Search,
  Copy,
  ExternalLink,
  ChevronRight,
  Sliders,
  Camera,
  CheckCircle2,
  XCircle,
  FileText,
  Award,
  Globe,
  Lock,
  Zap,
  Eye,
  Check,
  Sparkles,
  Building2,
  Calendar,
  User,
  Hash,
  Download,
  Share2,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, Badge, Modal, Toggle } from '@/components/ui/index';
import { MOCK_CERTIFICATES, MOCK_EVENTS } from '@/mocks/data';
import type { Certificate } from '@/types';
import { useToast } from '@/lib/toast-context';
import { KlubrioLogo } from '@/components/ui/logo';

export default function CertificateVerificationPage() {
  const { toast } = useToast();

  // Top header state
  const [selectedEventId, setSelectedEventId] = useState('evt-1');
  const [activeTab, setActiveTab] = useState<'setup' | 'issued' | 'analytics'>('setup');

  // Verification Settings state
  const [enablePublicVerification, setEnablePublicVerification] = useState(true);
  const [showCertificatePreview, setShowCertificatePreview] = useState(true);
  const [showParticipantDetails, setShowParticipantDetails] = useState(true);
  const [addVerificationQrCode, setAddVerificationQrCode] = useState(true);

  // Certificate Lookup state
  const [lookupId, setLookupId] = useState('');
  const [searchedCert, setSearchedCert] = useState<Certificate | null | 'not-found'>(MOCK_CERTIFICATES[0]);
  const [isVerifying, setIsVerifying] = useState(false);

  // Modals state
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [issuedCerts, setIssuedCerts] = useState<Certificate[]>(MOCK_CERTIFICATES);
  const [issuedFilter, setIssuedFilter] = useState<'all' | 'valid' | 'revoked'>('all');
  const [issuedSearch, setIssuedSearch] = useState('');

  // Customize page styling settings
  const [customAccentColor, setCustomAccentColor] = useState('#6366F1');
  const [customVerificationNote, setCustomVerificationNote] = useState(
    'This credential is mathematically verified on the Klubrio decentralized trust registry.'
  );

  const currentEvent = MOCK_EVENTS.find(e => e.id === selectedEventId) || MOCK_EVENTS[0];

  // Copy handler
  const handleCopyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast(`${label} copied to clipboard!`, 'success');
  };

  // Lookup verification
  const handleVerifyLookup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = lookupId.trim().toUpperCase();
    if (!query) {
      toast('Please enter a Certificate ID (e.g. HAR-2026-001)', 'warning');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      const found = issuedCerts.find(
        c =>
          c.certificateId.toUpperCase() === query ||
          c.participantName.toUpperCase().includes(query)
      );

      if (found) {
        setSearchedCert(found);
        if (found.status === 'valid') {
          toast(`Certificate ${found.certificateId} is authentic and valid!`, 'success');
        } else {
          toast(`Warning: Certificate ${found.certificateId} has been revoked`, 'warning');
        }
      } else {
        setSearchedCert('not-found');
        toast(`Certificate ID "${query}" not found in registry`, 'error');
      }
    }, 400);
  };

  // Revoke/Reinstate handler
  const handleToggleCertStatus = (id: string) => {
    setIssuedCerts(prev =>
      prev.map(c => {
        if (c.id === id) {
          const nextStatus = c.status === 'valid' ? 'revoked' : 'valid';
          toast(
            nextStatus === 'valid'
              ? `Certificate ${c.certificateId} reinstated`
              : `Certificate ${c.certificateId} marked as REVOKED`,
            nextStatus === 'valid' ? 'success' : 'warning'
          );
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  const filteredIssued = issuedCerts.filter(c => {
    const matchesFilter = issuedFilter === 'all' ? true : c.status === issuedFilter;
    const matchesSearch =
      c.certificateId.toLowerCase().includes(issuedSearch.toLowerCase()) ||
      c.participantName.toLowerCase().includes(issuedSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Breadcrumb & Header Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <Link href="/organiser/events" className="hover:text-[#6366F1] transition-colors">
                  Events
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-800 font-semibold truncate max-w-[240px] sm:max-w-none">
                  {currentEvent.title}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[#6366F1] font-semibold">Certificate Verification</span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Certificate Verification
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Configure public verification, look up issued certificates, and ensure credential authenticity.
              </p>
            </div>

            {/* Event Selector Dropdown */}
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
              <Badge variant="teal" className="hidden sm:inline-flex py-1 px-2.5 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                Tamper-Proof
              </Badge>
            </div>
          </div>

          {/* 3 Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 pb-1 scrollbar-none">
            {[
              { id: 'setup', label: 'Verification Setup', icon: Sliders },
              { id: 'issued', label: 'Issued Certificates', icon: Award },
              { id: 'analytics', label: 'Verification Analytics', icon: TrendingUp },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer',
                    isActive
                      ? 'bg-[#6366F1] text-white shadow-md shadow-indigo-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
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

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* TAB 1: Verification Setup (Two-Column Layout) */}
        {activeTab === 'setup' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Section 1 (Settings) + Section 2 (Lookup) (span 5) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Section 1: Verification Settings */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                    Section 1 · Configuration
                  </span>
                  <h2
                    className="text-xl font-bold text-[#0F172A] mt-1"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Verification Settings
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure how external institutions and recruiters verify credentials issued for this event.
                  </p>
                </div>

                {/* 4 Toggle Switches */}
                <div className="space-y-4 pt-2">
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                    <Toggle
                      checked={enablePublicVerification}
                      onChange={v => {
                        setEnablePublicVerification(v);
                        toast(`Public verification ${v ? 'enabled' : 'disabled'}`, 'info');
                      }}
                      label="Enable Public Verification"
                      description="Allow anyone with a Certificate ID to verify credentials online."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                    <Toggle
                      checked={showCertificatePreview}
                      onChange={v => {
                        setShowCertificatePreview(v);
                        toast(`Certificate preview ${v ? 'enabled' : 'hidden'}`, 'info');
                      }}
                      label="Show Certificate Preview"
                      description="Display high-resolution preview with security watermark."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                    <Toggle
                      checked={showParticipantDetails}
                      onChange={v => {
                        setShowParticipantDetails(v);
                        toast(`Participant details ${v ? 'included' : 'masked'}`, 'info');
                      }}
                      label="Show Participant Details"
                      description="Include participant full name, branch, and college."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                    <Toggle
                      checked={addVerificationQrCode}
                      onChange={v => {
                        setAddVerificationQrCode(v);
                        toast(`Verification QR code ${v ? 'active' : 'disabled'}`, 'info');
                      }}
                      label="Add Verification QR Code"
                      description="Embed cryptographic QR verification code on certificates."
                    />
                  </div>
                </div>

                {/* Verification Links */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Public Verification Page Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value="https://klubrio.in/verify"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-all"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Copy className="w-3.5 h-3.5" />}
                        onClick={() => handleCopyLink('https://klubrio.in/verify', 'Verification link')}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Event Verification Link <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`https://klubrio.in/verify/${selectedEventId}`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-all"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Copy className="w-3.5 h-3.5" />}
                        onClick={() =>
                          handleCopyLink(
                            `https://klubrio.in/verify/${selectedEventId}`,
                            'Event Verification link'
                          )
                        }
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Customize Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    fullWidth
                    icon={<Sliders className="w-4 h-4" />}
                    onClick={() => setCustomizeModalOpen(true)}
                  >
                    Customize Verification Page
                  </Button>
                </div>
              </div>

              {/* Section 2: Certificate Lookup */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 space-y-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                    Section 2 · Authenticity Check
                  </span>
                  <h2
                    className="text-xl font-bold text-[#0F172A] mt-1"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Certificate Lookup
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Test your verification pipeline by searching any issued Certificate ID.
                  </p>
                </div>

                <form onSubmit={handleVerifyLookup} className="space-y-3 pt-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. HAR-2026-001"
                        value={lookupId}
                        onChange={e => setLookupId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 uppercase"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isVerifying}
                      className="px-5 text-xs font-bold"
                    >
                      Verify
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    className="text-xs font-semibold"
                    icon={<Camera className="w-4 h-4" />}
                    onClick={() => setScanModalOpen(true)}
                  >
                    Scan QR Code
                  </Button>
                </form>

                {/* Quick Test Chips */}
                <div className="pt-2">
                  <span className="text-[11px] text-slate-400 block mb-1.5">
                    Quick test existing IDs:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {issuedCerts.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setLookupId(c.certificateId);
                          setSearchedCert(c);
                          toast(`Loaded ${c.certificateId}`, 'info');
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-[#6366F1] transition-colors border border-slate-200/60"
                      >
                        {c.certificateId}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Section 3 (Preview) + Section 4 (Result Example) (span 7) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Section 3: Public Verification Page Preview */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Simulated Browser Frame Bar */}
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" /> https://klubrio.in/verify
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Live Public Viewport Preview
                  </span>
                </div>

                {/* Public Viewport Content Inside Fake Browser */}
                <div className="p-6 sm:p-8 bg-slate-50/50 flex flex-col items-center text-center">
                  <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
                    {/* Klubrio Logo + Club Identity */}
                    <div className="flex flex-col items-center mb-4">
                      <KlubrioLogo size="sm" href="/" />
                      <span className="text-xs font-semibold text-slate-500 mt-2 bg-slate-100 px-3 py-0.5 rounded-full">
                        {currentEvent.clubName} Credential Portal
                      </span>
                    </div>

                    <h3
                      className="text-xl sm:text-2xl font-black text-[#0F172A] mt-2"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      Verify a Certificate
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Enter the unique Certificate ID printed on your document or scan the embedded QR code.
                    </p>

                    {/* Certificate ID input + Verify button */}
                    <div className="mt-5 space-y-2.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={lookupId || 'HAR-2026-001'}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-700 uppercase"
                        />
                        <button
                          onClick={() => handleVerifyLookup()}
                          className="px-4 py-2 bg-[#6366F1] text-white text-xs font-bold rounded-xl hover:bg-[#5558e6] transition-colors"
                        >
                          Verify
                        </button>
                      </div>

                      <button
                        onClick={() => setScanModalOpen(true)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" /> or Scan QR Code
                      </button>
                    </div>

                    {/* Three Trust Badges */}
                    <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-slate-100 text-center">
                      <div className="p-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6366F1] flex items-center justify-center mx-auto mb-1">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-800 leading-tight">Official Certificates</p>
                        <p className="text-[9px] text-slate-400">Presidency University</p>
                      </div>

                      <div className="p-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                          <Zap className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-800 leading-tight">Instant Verification</p>
                        <p className="text-[9px] text-slate-400">Real-time ledger</p>
                      </div>

                      <div className="p-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1">
                          <Lock className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-800 leading-tight">Tamper-Proof</p>
                        <p className="text-[9px] text-slate-400">Cryptographic hash</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Verification Result Example */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 space-y-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                    Section 4 · Live Validation State
                  </span>
                  <h3
                    className="text-xl font-bold text-[#0F172A] mt-1"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Verification Result Example
                  </h3>
                </div>

                {/* Status Banners */}
                {searchedCert === 'not-found' ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-800">Certificate Not Found</h4>
                      <p className="text-xs text-rose-600 mt-0.5">
                        No record matches this Certificate ID. Please double check the ID code or contact the event organiser.
                      </p>
                    </div>
                  </div>
                ) : searchedCert?.status === 'revoked' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-800">Certificate Revoked</h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        This certificate was invalidated or superseded by HARVEST AgriTech Innovation Club.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Green Banner: Certificate Verified */
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">Certificate Verified</h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        This certificate is authentic and was issued by HARVEST AgriTech Innovation Club.
                      </p>
                    </div>
                  </div>
                )}

                {/* Certificate Preview Placeholder Graphic */}
                {showCertificatePreview && searchedCert && searchedCert !== 'not-found' && (
                  <div className="relative border-4 border-double border-slate-300 rounded-2xl p-6 bg-gradient-to-br from-amber-50/20 via-white to-slate-50 text-center overflow-hidden shadow-inner">
                    {/* Security Watermark Note */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5 rotate-[-25deg]">
                      <span className="text-6xl font-black text-slate-900 uppercase">
                        VERIFIED · KLUBRIO
                      </span>
                    </div>

                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          PRESIDENCY UNIVERSITY
                        </span>
                        {addVerificationQrCode && (
                          <div className="w-10 h-10 border border-slate-200 p-1 bg-white rounded shadow-2xs">
                            <QrCode className="w-full h-full text-slate-800" />
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] font-bold tracking-widest text-[#6366F1] uppercase">
                          CERTIFICATE OF PARTICIPATION
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">Proudly presented to</p>
                        <h4
                          className="text-xl font-bold text-slate-900 mt-1"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          {searchedCert.participantName}
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          for participating and pitching during{' '}
                          <strong className="text-slate-700">{searchedCert.eventName}</strong> held on{' '}
                          {formatDate(currentEvent.date)}.
                        </p>
                      </div>

                      <div className="pt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Club Lead: HARVEST</span>
                        <span className="font-mono text-emerald-600 font-semibold">
                          ID: {searchedCert.certificateId}
                        </span>
                        <span>Date: {searchedCert.issueDate}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Table */}
                {showParticipantDetails && searchedCert && searchedCert !== 'not-found' && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-500 w-1/3">
                            Participant Name
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {searchedCert.participantName}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold text-slate-500">Event Name</td>
                          <td className="py-2.5 px-4 text-slate-800">{searchedCert.eventName}</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-500">Event Date</td>
                          <td className="py-2.5 px-4 text-slate-800">
                            {formatDate(currentEvent.date)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold text-slate-500">Organised By</td>
                          <td className="py-2.5 px-4 text-slate-800">{searchedCert.clubName}</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-500">
                            Certificate Type
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800 capitalize">
                            Certificate of {searchedCert.type}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold text-slate-500">
                            Certificate ID
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#6366F1]">
                            {searchedCert.certificateId}
                          </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-500">Issue Date</td>
                          <td className="py-2.5 px-4 text-slate-800">{searchedCert.issueDate}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Issued Certificates Table */}
        {activeTab === 'issued' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                  Certificate Registry
                </span>
                <h2
                  className="text-xl font-bold text-[#0F172A] mt-1"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  All Issued Certificates ({issuedCerts.length})
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Manage individual certificates, verify hashes, and revoke or reinstate credentials.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => toast('Exporting all issued certificate credentials as CSV', 'success')}
                >
                  Export All
                </Button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by ID or participant name..."
                  value={issuedSearch}
                  onChange={e => setIssuedSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>

              <div className="w-full sm:w-44">
                <Select
                  value={issuedFilter}
                  onChange={e => setIssuedFilter(e.target.value as any)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'valid', label: 'Valid Only' },
                    { value: 'revoked', label: 'Revoked Only' },
                  ]}
                  className="bg-slate-50 border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Certificate ID</th>
                    <th className="py-3 px-4">Recipient Name</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIssued.map(cert => (
                    <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#6366F1]">
                        {cert.certificateId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {cert.participantName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {cert.eventName}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-500">{cert.type}</td>
                      <td className="py-3 px-4 text-slate-600">{cert.issueDate}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={cert.status === 'valid' ? 'teal' : 'red'}
                          className="font-bold"
                        >
                          {cert.status === 'valid' ? 'Valid' : 'Revoked'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs py-1 px-2.5 h-7"
                            onClick={() => {
                              setLookupId(cert.certificateId);
                              setSearchedCert(cert);
                              setActiveTab('setup');
                            }}
                          >
                            Inspect
                          </Button>
                          <Button
                            size="sm"
                            variant={cert.status === 'valid' ? 'danger' : 'outline'}
                            className="text-xs py-1 px-2.5 h-7"
                            onClick={() => handleToggleCertStatus(cert.id)}
                          >
                            {cert.status === 'valid' ? 'Revoke' : 'Reinstate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Verification Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Total Verification Scans
                </span>
                <p
                  className="text-3xl font-black text-[#0F172A] mt-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  342
                </p>
                <span className="text-xs font-bold text-emerald-600 mt-1 inline-flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> +28% this week
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Recruiter Inquiries
                </span>
                <p
                  className="text-3xl font-black text-[#6366F1] mt-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  89
                </p>
                <span className="text-xs text-slate-400 mt-1 block">LinkedIn & CV links</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Tamper Attempts Caught
                </span>
                <p
                  className="text-3xl font-black text-emerald-600 mt-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  0
                </p>
                <span className="text-xs text-emerald-600 font-bold mt-1 block">100% Integrity</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Median Lookup Latency
                </span>
                <p
                  className="text-3xl font-black text-blue-600 mt-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  180ms
                </p>
                <span className="text-xs text-slate-400 mt-1 block">Global Edge CDN</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Recent Verification Queries
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Audit log of all public certificate validations processed in the last 24 hours.
              </p>

              <div className="space-y-3">
                {[
                  { id: 'HAR-2026-001', name: 'Rhea Sharma', ip: 'Bangalore, Karnataka', time: '12 mins ago', valid: true },
                  { id: 'HAR-2026-002', name: 'Karan Malik', ip: 'Mumbai, Maharashtra', time: '1 hour ago', valid: true },
                  { id: 'HAR-2026-001', name: 'Rhea Sharma', ip: 'London, UK (Recruiter)', time: '3 hours ago', valid: true },
                  { id: 'HAR-2026-003', name: 'Varun S', ip: 'Hyderabad, Telangana', time: '5 hours ago', valid: false },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          item.valid ? 'bg-emerald-500' : 'bg-amber-500'
                        )}
                      />
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {item.id}
                        </span>{' '}
                        <span className="text-xs text-slate-600">({item.name})</span>
                        <p className="text-[11px] text-slate-400">{item.ip}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.valid ? 'teal' : 'yellow'} className="text-[10px]">
                        {item.valid ? 'Verified OK' : 'Revoked Notice'}
                      </Badge>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Customize Verification Page */}
      <Modal
        open={customizeModalOpen}
        onClose={() => setCustomizeModalOpen(false)}
        title="Customize Public Verification Page"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Customize the look and feel of your external certificate verification portal to match your club branding.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Brand Accent Color
            </label>
            <div className="flex gap-2.5">
              {['#6366F1', '#3B82F6', '#10B981', '#0F172A', '#8B5CF6', '#EC4899'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCustomAccentColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-transform',
                    customAccentColor === c ? 'scale-110 border-slate-900 shadow-sm' : 'border-white'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Custom Trust & Verification Disclaimer Note
            </label>
            <textarea
              rows={3}
              value={customVerificationNote}
              onChange={e => setCustomVerificationNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCustomizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setCustomizeModalOpen(false);
                toast('Custom portal settings saved!', 'success');
              }}
            >
              Save Customizations
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: QR Scanner Modal */}
      <Modal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        title="Scan Certificate QR Code"
        size="md"
      >
        <div className="space-y-4 text-center">
          <div className="relative aspect-square max-w-xs mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-slate-800 shadow-xl">
            <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl relative flex items-center justify-center">
              <div className="absolute inset-x-2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#10B981] animate-bounce" />
              <Camera className="w-10 h-10 text-white/40" />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Center the verification QR code found on the physical or PDF certificate.
          </p>

          <div className="pt-2">
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setLookupId('HAR-2026-001');
                setSearchedCert(issuedCerts[0]);
                setScanModalOpen(false);
                toast('QR Code scanned: HAR-2026-001 verified!', 'success');
              }}
            >
              Simulate Successful Scan (HAR-2026-001)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
