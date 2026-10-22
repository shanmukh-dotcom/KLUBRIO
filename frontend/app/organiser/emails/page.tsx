'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Send,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  FileText,
  Sparkles,
  ChevronRight,
  MoreVertical,
  Paperclip,
  Image as ImageIcon,
  Link2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Code,
  Eye,
  AlertCircle,
  Copy,
  ChevronDown,
  Info,
  Check,
  TrendingUp,
  MousePointerClick,
  MailCheck,
  Smartphone,
  Monitor,
  X
} from 'lucide-react';

import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, Badge, Modal, Toggle } from '@/components/ui/index';
import { MOCK_EMAIL_CAMPAIGNS, MOCK_EVENTS } from '@/mocks/data';
import type { EmailCampaign, EmailTemplate } from '@/types';
import { useToast } from '@/lib/toast-context';

interface TemplateOption {
  id: EmailTemplate;
  name: string;
  badge: string;
  description: string;
  defaultSubject: string;
  defaultBody: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'registration_confirmation',
    name: 'Registration Confirmation',
    badge: 'Transactional',
    description: 'Sent instantly when participant registration is confirmed.',
    defaultSubject: "Registration Confirmed: Nexovate 2.0: The Engineer's Pitch",
    defaultBody: `Hi {{Full Name}},

Thank you for registering for Nexovate 2.0: The Engineer's Pitch! Your spot is officially confirmed.

Event Details:
📅 Date: September 11, 2026
⏰ Time: 4:00 PM - 7:00 PM
📍 Venue: E Block, Seminar Hall 3
🎫 Your Registration ID: {{Registration ID}}

Your entry QR pass is attached to this email. Please display it at the venue check-in desk.

Looking forward to your innovative pitch!
The HARVEST Organising Team`,
  },
  {
    id: 'event_reminder',
    name: 'Event Reminder',
    badge: 'High Open Rate',
    description: 'Notify participants 24 hours and 2 hours before kick-off.',
    defaultSubject: "Reminder: Nexovate 2.0: The Engineer's Pitch is Tomorrow!",
    defaultBody: `Hi {{Full Name}},

This is a friendly reminder that Nexovate 2.0: The Engineer's Pitch starts tomorrow!

📅 Date: September 11, 2026
⏰ Check-in Opens: 3:30 PM (Event begins at 4:00 PM)
📍 Venue: E Block, Seminar Hall 3
🎫 Registration ID: {{Registration ID}}

Make sure to arrive early to test your presentation slides and collect your welcome kit.

See you there!
HARVEST AgriTech Club`,
  },
  {
    id: 'event_update',
    name: 'Event Update',
    badge: 'Announcement',
    description: 'Important logistics updates, schedule shifts, or venue adjustments.',
    defaultSubject: 'Important Update: Room Change for Nexovate 2.0',
    defaultBody: `Dear {{Full Name}},

Please note an important venue update regarding Nexovate 2.0:

📍 NEW Venue: Auditorium A, Main Academic Block (Moved from Seminar Hall 3)
📅 Date: September 11, 2026
⏰ Time: 4:00 PM - 7:00 PM

All other registration details and your entry QR pass ({{Registration ID}}) remain unchanged.

Best regards,
Event Operations Team`,
  },
  {
    id: 'certificate_delivery',
    name: 'Certificate Delivery',
    badge: 'Post-Event',
    description: 'Send verified certificate credentials with verification links.',
    defaultSubject: 'Your Certificate for Nexovate 2.0 is Ready to Download',
    defaultBody: `Congratulations {{Full Name}}!

Thank you for participating in Nexovate 2.0: The Engineer's Pitch. Your verified Certificate of Participation has been issued.

🔗 View & Download Certificate: {{Certificate Link}}
🆔 Certificate ID: {{Certificate ID}}

You can also add this tamper-proof credential to your LinkedIn profile with one click.

Warm regards,
HARVEST AgriTech Innovation Club`,
  },
  {
    id: 'post_event_followup',
    name: 'Post Event Follow Up',
    badge: 'Feedback',
    description: 'Thank attendees, share session slides, and collect feedback surveys.',
    defaultSubject: 'Thank You for Attending Nexovate 2.0 — Share Your Feedback',
    defaultBody: `Hi {{Full Name}},

Thank you for making Nexovate 2.0 an incredible success! Over 120 aspiring engineers pitched brilliant ideas.

We would love to hear your feedback:
📝 Quick 2-Minute Feedback Survey: https://klubrio.in/feedback/nexovate
📸 Event Photos & Highlights: https://klubrio.in/events/evt-1/gallery

Stay tuned for our upcoming AgriTech Hackathon in November!

Cheers,
The HARVEST Organising Committee`,
  },
  {
    id: 'custom',
    name: 'Custom Email',
    badge: 'Freeform',
    description: 'Draft a custom broadcast message with personalized merge tags.',
    defaultSubject: 'Special Announcement: Nexovate 2.0',
    defaultBody: `Hi {{Full Name}},

We have an exciting announcement regarding Nexovate 2.0...

Write your custom message here. You can include {{Event Name}}, {{Registration ID}}, and other dynamic fields.

Best regards,
HARVEST Club Organisers`,
  },
];

type RecipientFilter = 'all' | 'approved' | 'checked-in' | 'not-checked-in' | 'specific' | 'custom';

const RECIPIENT_COUNTS: Record<RecipientFilter, number> = {
  all: 128,
  approved: 102,
  'checked-in': 112,
  'not-checked-in': 16,
  specific: 8,
  custom: 42,
};

export default function EmailsCampaignsPage() {
  const { toast } = useToast();

  // Top header state
  const [selectedEventId, setSelectedEventId] = useState('evt-1');
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'scheduled' | 'history'>('compose');

  // Column 1: Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<EmailTemplate>('registration_confirmation');

  // Column 2: Editor content state
  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
  const [subject, setSubject] = useState(currentTemplate.defaultSubject);
  const [body, setBody] = useState(currentTemplate.defaultBody);
  const [includeBanner, setIncludeBanner] = useState(true);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  // Column 3: Recipients & Sending options
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');
  const [sendTiming, setSendTiming] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('2026-09-11');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [sendTestEmail, setSendTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('organiser@presidency.edu');
  const [trackOpens, setTrackOpens] = useState(true);

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [reportModalCampaign, setReportModalCampaign] = useState<EmailCampaign | null>(null);

  // Campaigns list state (allows live appending when sending)
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>(MOCK_EMAIL_CAMPAIGNS);
  const [isSending, setIsSending] = useState(false);

  // Handle template change
  const handleSelectTemplate = (tmpl: TemplateOption) => {
    setSelectedTemplateId(tmpl.id);
    setSubject(tmpl.defaultSubject);
    setBody(tmpl.defaultBody);
    toast(`Loaded "${tmpl.name}" template`, 'info');
  };

  // Insert merge field
  const handleInsertField = (fieldTag: string) => {
    setBody(prev => prev + ' ' + fieldTag);
    setShowFieldDropdown(false);
    toast(`Inserted merge tag ${fieldTag}`, 'success');
  };

  // Actions
  const handleSendTestEmail = () => {
    if (!testEmailAddress.includes('@')) {
      toast('Please enter a valid test email address', 'warning');
      return;
    }
    toast(`Test email sent to ${testEmailAddress}!`, 'success');
  };

  const handleSendCampaign = () => {
    const count = RECIPIENT_COUNTS[recipientFilter];
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      const newCampaign: EmailCampaign = {
        id: `ec-${Date.now().toString().slice(-4)}`,
        eventId: selectedEventId,
        subject,
        template: selectedTemplateId,
        recipientCount: count,
        sentAt: new Date().toISOString(),
        status: sendTiming === 'now' ? 'sent' : 'scheduled',
        delivered: count,
        opened: 0,
        clicked: 0,
      };

      setCampaigns(prev => [newCampaign, ...prev]);

      if (sendTiming === 'now') {
        toast(`Email broadcast dispatched to ${count} recipients!`, 'success');
      } else {
        toast(`Email broadcast scheduled for ${scheduleDate} at ${scheduleTime}!`, 'success');
      }
    }, 900);
  };

  const currentEvent = MOCK_EVENTS.find(e => e.id === selectedEventId) || MOCK_EVENTS[0];
  const recipientCount = RECIPIENT_COUNTS[recipientFilter];

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
                <span className="text-[#6366F1] font-semibold">Emails & Notifications</span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Emails & Notifications
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Create and send announcements, reminders, and updates to your event participants.
              </p>
            </div>

            {/* Event selector */}
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
              <Badge variant="violet" className="hidden sm:inline-flex py-1 px-2.5 font-bold">
                Campaign Manager
              </Badge>
            </div>
          </div>

          {/* 4 Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 pb-1 scrollbar-none">
            {[
              { id: 'compose', label: 'Compose Email', icon: Mail },
              { id: 'templates', label: 'Templates', icon: FileText },
              { id: 'scheduled', label: 'Scheduled Emails', icon: Calendar },
              { id: 'history', label: 'Campaign History', icon: Clock },
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
        {/* Three-Column Layout for Compose Email */}
        {(activeTab === 'compose' || activeTab === 'templates') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: 1. Choose a Template (span 3) */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  Choose a Template
                </h3>
                <span className="text-[11px] font-medium text-slate-400">
                  {TEMPLATES.length} options
                </span>
              </div>

              <div className="space-y-2.5">
                {TEMPLATES.map(tmpl => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={cn(
                        'p-3.5 rounded-xl border text-left cursor-pointer transition-all relative group',
                        isSelected
                          ? 'border-[#6366F1] bg-indigo-50/40 shadow-sm border-l-4 border-l-[#6366F1]'
                          : 'border-slate-200/70 hover:border-slate-300 bg-white hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-[#6366F1] transition-colors">
                          {tmpl.name}
                        </span>
                        {isSelected && (
                          <ChevronRight className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {tmpl.description}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {tmpl.badge}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CENTER COLUMN: 2. Edit Email Content (span 5) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  Edit Email Content
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs py-1 px-2.5 h-8 font-semibold"
                  icon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => setPreviewOpen(true)}
                >
                  Preview Email
                </Button>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Enter a compelling subject..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 focus:bg-white transition-all"
                />
              </div>

              {/* Rich Text Toolbar */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-100/60 flex-wrap gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toast('Bold format applied', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Italic format applied', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Underline format applied', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Underline"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => toast('Bulleted list added', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Bullet List"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Numbered list added', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Numbered List"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => toast('Insert hyperlink', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Insert image', 'info')}
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                      title="Image"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Insert Field Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowFieldDropdown(v => !v)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#6366F1] hover:border-[#6366F1] shadow-2xs transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-[#6366F1]" />
                      Insert Field
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showFieldDropdown && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5">
                        <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Merge Tags
                        </p>
                        {[
                          '{{Full Name}}',
                          '{{Event Name}}',
                          '{{Date}}',
                          '{{Time}}',
                          '{{Venue}}',
                          '{{Registration ID}}',
                          '{{QR Code Link}}',
                          '{{Certificate Link}}',
                        ].map(field => (
                          <button
                            key={field}
                            type="button"
                            onClick={() => handleInsertField(field)}
                            className="w-full text-left px-3 py-1.5 text-xs font-mono text-slate-700 hover:bg-indigo-50 hover:text-[#6366F1] transition-colors"
                          >
                            {field}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Body Editor */}
                <textarea
                  rows={13}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full p-4 bg-white text-xs sm:text-sm text-slate-800 leading-relaxed font-sans placeholder:text-slate-400 focus:outline-none resize-none"
                  placeholder="Draft your email message..."
                />
              </div>

              {/* Event Details Box Preview inside Body */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBanner}
                      onChange={e => setIncludeBanner(e.target.checked)}
                      className="rounded border-slate-300 text-[#6366F1] focus:ring-[#6366F1]"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Add event banner & branded header
                    </span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Nexovate 2.0 Branded</span>
                </div>

                {includeBanner && (
                  <div className="h-14 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#10B981] flex items-center justify-between px-4 text-white">
                    <span className="font-bold text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Nexovate 2.0 Official Communications
                    </span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
                      HARVEST
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: 3. Select Recipients & 4. Sending Options (span 4) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Section 3: Select Recipients */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center text-[10px] font-black">
                      3
                    </span>
                    Select Recipients
                  </h3>
                  <Badge variant="teal" className="text-[10px] font-bold">
                    {recipientCount} targeted
                  </Badge>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'all', label: 'All Registered Participants', count: 128 },
                    { id: 'approved', label: 'Approved Participants', count: 102 },
                    { id: 'checked-in', label: 'Checked-In Participants', count: 112 },
                    { id: 'not-checked-in', label: 'Not Checked-In Participants', count: 16 },
                  ].map(option => (
                    <label
                      key={option.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                        recipientFilter === option.id
                          ? 'border-[#6366F1] bg-indigo-50/30 font-semibold'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="recipientOption"
                          checked={recipientFilter === option.id}
                          onChange={() => setRecipientFilter(option.id as any)}
                          className="text-[#6366F1] focus:ring-[#6366F1]"
                        />
                        <span className="text-xs text-slate-800">{option.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {option.count}
                      </span>
                    </label>
                  ))}

                  {/* Specific Participants option */}
                  <div
                    className={cn(
                      'p-3 rounded-xl border transition-all flex items-center justify-between',
                      recipientFilter === 'specific'
                        ? 'border-[#6366F1] bg-indigo-50/30'
                        : 'border-slate-200'
                    )}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="recipientOption"
                        checked={recipientFilter === 'specific'}
                        onChange={() => setRecipientFilter('specific')}
                        className="text-[#6366F1] focus:ring-[#6366F1]"
                      />
                      <span className="text-xs font-medium text-slate-800">
                        Specific Participants
                      </span>
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-[11px] py-1 px-2.5 h-7"
                      onClick={() => {
                        setRecipientFilter('specific');
                        toast('Participant selection modal opened', 'info');
                      }}
                    >
                      Select
                    </Button>
                  </div>

                  {/* Custom Filter option */}
                  <div
                    className={cn(
                      'p-3 rounded-xl border transition-all flex items-center justify-between',
                      recipientFilter === 'custom'
                        ? 'border-[#6366F1] bg-indigo-50/30'
                        : 'border-slate-200'
                    )}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="recipientOption"
                        checked={recipientFilter === 'custom'}
                        onChange={() => setRecipientFilter('custom')}
                        className="text-[#6366F1] focus:ring-[#6366F1]"
                      />
                      <span className="text-xs font-medium text-slate-800">
                        Custom Filter (Branch/Year)
                      </span>
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-[11px] py-1 px-2.5 h-7"
                      onClick={() => {
                        setRecipientFilter('custom');
                        toast('Custom filter criteria updated', 'info');
                      }}
                    >
                      Set Filter
                    </Button>
                  </div>
                </div>
              </div>

              {/* Section 4: Sending Options */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center text-[10px] font-black">
                      4
                    </span>
                    Sending Options
                  </h3>
                </div>

                {/* Send Now vs Schedule radio */}
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={cn(
                      'p-3 rounded-xl border text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1',
                      sendTiming === 'now'
                        ? 'border-[#6366F1] bg-indigo-50/40 font-bold text-[#6366F1]'
                        : 'border-slate-200 text-slate-600'
                    )}
                  >
                    <input
                      type="radio"
                      name="sendTiming"
                      className="sr-only"
                      checked={sendTiming === 'now'}
                      onChange={() => setSendTiming('now')}
                    />
                    <Send className="w-4 h-4" />
                    <span className="text-xs">Send Now</span>
                  </label>

                  <label
                    className={cn(
                      'p-3 rounded-xl border text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1',
                      sendTiming === 'schedule'
                        ? 'border-[#6366F1] bg-indigo-50/40 font-bold text-[#6366F1]'
                        : 'border-slate-200 text-slate-600'
                    )}
                  >
                    <input
                      type="radio"
                      name="sendTiming"
                      className="sr-only"
                      checked={sendTiming === 'schedule'}
                      onChange={() => setSendTiming('schedule')}
                    />
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Schedule for Later</span>
                  </label>
                </div>

                {/* If scheduled, show date & time pickers */}
                {sendTiming === 'schedule' && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Schedule Date
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Schedule Time
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {/* Toggle: Send test email to myself */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Toggle
                    checked={sendTestEmail}
                    onChange={setSendTestEmail}
                    label="Send test email to myself"
                    description="Preview rendered content in your personal inbox."
                  />

                  {sendTestEmail && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={e => setTestEmailAddress(e.target.value)}
                        placeholder="your-email@campus.edu"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* Toggle: Track email opens and clicks */}
                <div className="pt-2 border-t border-slate-100">
                  <Toggle
                    checked={trackOpens}
                    onChange={setTrackOpens}
                    label="Track email opens and clicks"
                    description="Embed transparent pixel for engagement analytics."
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-4 space-y-2">
                  {sendTestEmail && (
                    <Button
                      variant="secondary"
                      size="md"
                      fullWidth
                      className="text-xs font-bold"
                      onClick={handleSendTestEmail}
                    >
                      Send Test Email
                    </Button>
                  )}

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isSending}
                    className="text-sm font-bold shadow-lg shadow-indigo-500/20"
                    icon={<Send className="w-4 h-4" />}
                    onClick={handleSendCampaign}
                  >
                    {sendTiming === 'now'
                      ? `Send Email (${recipientCount})`
                      : `Schedule Broadcast (${recipientCount})`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Email Campaigns Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                Campaign Archives & Metrics
              </span>
              <h2
                className="text-xl font-bold text-[#0F172A] mt-1"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Recent Email Campaigns
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Delivery performance, open rates, and click engagement for sent broadcasts.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              onClick={() => toast('Exporting campaign engagement CSV report...', 'success')}
            >
              Export Report
            </Button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Template</th>
                  <th className="py-3 px-4 text-center">Recipients</th>
                  <th className="py-3 px-4">Sent On</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Delivered</th>
                  <th className="py-3 px-4 text-center">Opened %</th>
                  <th className="py-3 px-4 text-center">Clicked %</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp, index) => {
                  const deliveredCount = camp.delivered ?? camp.recipientCount;
                  const openPct = Math.round(((camp.opened ?? 0) / deliveredCount) * 100);
                  const clickPct = Math.round(((camp.clicked ?? 0) / deliveredCount) * 100);

                  return (
                    <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 max-w-xs truncate">
                          {camp.subject}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">{camp.id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {camp.template.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {camp.recipientCount}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(camp.sentAt)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="teal" className="inline-flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Completed
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-600 font-semibold">
                        {deliveredCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800">{openPct}%</span>
                          <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${openPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800">{clickPct}%</span>
                          <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${clickPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs py-1 px-2.5 h-7"
                            onClick={() => setReportModalCampaign(camp)}
                          >
                            View Report
                          </Button>
                          <button
                            onClick={() => toast('Campaign options opened', 'info')}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: Email Live Preview (Desktop & Mobile viewports) */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Email Broadcast Live Preview"
        size="lg"
      >
        <div className="space-y-4">
          {/* Viewport switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="text-xs text-slate-500">
              Simulating merge tags with sample attendee: <span className="font-bold text-slate-800">Rhea Sharma (REG-001)</span>
            </div>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all',
                  previewDevice === 'desktop' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                )}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all',
                  previewDevice === 'mobile' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                )}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </button>
            </div>
          </div>

          {/* Email Canvas */}
          <div className="flex justify-center bg-slate-100 p-4 sm:p-6 rounded-2xl">
            <div
              className={cn(
                'bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all',
                previewDevice === 'mobile' ? 'w-80' : 'w-full max-w-2xl'
              )}
            >
              {/* Fake Email Client Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span>From: <strong className="text-slate-700">Nexovate Organisers &lt;events@klubrio.in&gt;</strong></span>
                  <span className="text-[10px] font-mono">Today, 4:00 PM</span>
                </div>
                <div className="text-slate-500">
                  To: <strong className="text-slate-700">Rhea Sharma &lt;rhea@example.com&gt;</strong>
                </div>
                <div className="font-bold text-slate-900 pt-1 text-sm">
                  {subject.replace('{{Full Name}}', 'Rhea Sharma')}
                </div>
              </div>

              {/* Rendered Email Body */}
              <div className="p-6 space-y-4">
                {includeBanner && (
                  <div className="h-24 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#10B981] flex flex-col justify-center px-6 text-white shadow-sm">
                    <span className="text-xs uppercase font-bold tracking-widest text-emerald-200">
                      PRESIDENCY UNIVERSITY CAMPUS
                    </span>
                    <h3 className="text-lg font-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Nexovate 2.0: The Engineer&apos;s Pitch
                    </h3>
                  </div>
                )}

                <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                  {body
                    .replace(/{{Full Name}}/g, 'Rhea Sharma')
                    .replace(/{{Event Name}}/g, "Nexovate 2.0: The Engineer's Pitch")
                    .replace(/{{Registration ID}}/g, 'REG-001')
                    .replace(/{{Date}}/g, 'September 11, 2026')
                    .replace(/{{Time}}/g, '4:00 PM - 7:00 PM')
                    .replace(/{{Venue}}/g, 'E Block, Seminar Hall 3')
                    .replace(/{{Certificate Link}}/g, 'https://klubrio.in/verify/HAR-2026-001')
                    .replace(/{{Certificate ID}}/g, 'HAR-2026-001')}
                </div>

                {/* Footer */}
                <div className="pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400 space-y-1">
                  <p>Sent via Klubrio Campus Community Platform</p>
                  <p>Presidency University, Bangalore · You received this because you registered for Nexovate 2.0.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setPreviewOpen(false);
                handleSendCampaign();
              }}
            >
              Confirm & Send Broadcast
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Campaign Performance Report Modal */}
      <Modal
        open={!!reportModalCampaign}
        onClose={() => setReportModalCampaign(null)}
        title="Campaign Engagement Analytics"
        size="md"
      >
        {reportModalCampaign && (
          <div className="space-y-5">
            <div>
              <span className="text-xs font-bold text-[#6366F1] uppercase tracking-wider">
                Performance Summary
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {reportModalCampaign.subject}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatched on {formatDate(reportModalCampaign.sentAt)} to{' '}
                {reportModalCampaign.recipientCount} attendees.
              </p>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Delivered</span>
                <span className="text-xl font-black text-slate-900 block mt-1">
                  {reportModalCampaign.delivered ?? reportModalCampaign.recipientCount}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">100% Rate</span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center">
                <span className="text-[11px] font-bold text-emerald-700 uppercase">Opened</span>
                <span className="text-xl font-black text-emerald-600 block mt-1">
                  {reportModalCampaign.opened ?? 0}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">
                  {Math.round(((reportModalCampaign.opened ?? 0) / reportModalCampaign.recipientCount) * 100)}% Open Rate
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-center">
                <span className="text-[11px] font-bold text-blue-700 uppercase">Clicked</span>
                <span className="text-xl font-black text-blue-600 block mt-1">
                  {reportModalCampaign.clicked ?? 0}
                </span>
                <span className="text-[10px] text-blue-700 font-bold">
                  {Math.round(((reportModalCampaign.clicked ?? 0) / reportModalCampaign.recipientCount) * 100)}% CTR
                </span>
              </div>
            </div>

            {/* Activity breakdown */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Unique Link Clicks:</span>
                <span className="font-bold text-slate-900">{reportModalCampaign.clicked ?? 0} clicks</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Bounces / Failed:</span>
                <span className="font-bold text-emerald-600">0 (Clean Delivery)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Unsubscribes:</span>
                <span className="font-bold text-slate-900">0</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setReportModalCampaign(null)}>
                Close Report
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
