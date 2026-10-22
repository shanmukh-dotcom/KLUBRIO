'use client';

import React, { useState } from 'react';
import {
  User,
  Bell,
  Lock,
  Eye,
  Sun,
  Moon,
  Monitor,
  Check,
  Shield,
  Save,
  Mail,
  Smartphone,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { Card, Badge, Toggle } from '@/components/ui/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';

export default function StudentSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Notification Preferences State
  const [notifications, setNotifications] = useState({
    eventRemindersEmail: true,
    eventRemindersPush: true,
    clubAnnouncementsEmail: true,
    clubAnnouncementsPush: false,
    directMessagesEmail: false,
    directMessagesPush: true,
    weeklyDigestEmail: true,
  });

  // Privacy Preferences State
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showMemberships: true,
    allowDirectMessages: true,
    showEmailToPeers: false,
  });

  // Theme State
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAll = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast('Your preferences have been saved successfully!', 'success');
    }, 600);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Account Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your account details, notification channels, privacy visibility, and platform look & feel
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Save className="w-4 h-4" />}
          loading={isSaving}
          onClick={handleSaveAll}
        >
          Save Changes
        </Button>
      </div>

      {/* 1. Account Details (Read Only / Student Credentials) */}
      <Card padding="lg" className="space-y-5">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-[#6366F1]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="text-base sm:text-lg font-bold text-[#0F172A]"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Student Credentials
            </h2>
            <p className="text-xs text-gray-400">
              Information linked to your university enrollment records
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Full Legal Name
            </label>
            <input
              type="text"
              readOnly
              value={user?.fullName || 'Ballaya'}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Student University Email
            </label>
            <input
              type="email"
              readOnly
              value={user?.email || 'ballaya@example.com'}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Institution
            </label>
            <input
              type="text"
              readOnly
              value={user?.college || 'Presidency University'}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Enrolled Department
            </label>
            <input
              type="text"
              readOnly
              value={user?.branch || 'CSE (AI & ML)'}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-700">
          <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            These official details are verified via campus SSO credentials. To request changes to your name or roll number, please contact your university administrative registrar.
          </span>
        </div>
      </Card>

      {/* 2. Notification Preferences */}
      <Card padding="lg" className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="text-base sm:text-lg font-bold text-[#0F172A]"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Notification Preferences
            </h2>
            <p className="text-xs text-gray-400">
              Customize how and when you receive reminders, updates, and messages
            </p>
          </div>
        </div>

        <div className="space-y-5 divide-y divide-gray-100">
          {/* Event reminders */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-[#0F172A]">Event Schedule Reminders</h4>
              <p className="text-xs text-gray-500">
                Receive notifications 24 hours and 1 hour before registered sessions begin
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Toggle
                checked={notifications.eventRemindersEmail}
                onChange={(v) => setNotifications({ ...notifications, eventRemindersEmail: v })}
                label="Email"
              />
              <Toggle
                checked={notifications.eventRemindersPush}
                onChange={(v) => setNotifications({ ...notifications, eventRemindersPush: v })}
                label="Push"
              />
            </div>
          </div>

          {/* Club announcements */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-[#0F172A]">Club Announcements & News</h4>
              <p className="text-xs text-gray-500">
                Updates, recruitments, and post-event discussions from clubs you have joined
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Toggle
                checked={notifications.clubAnnouncementsEmail}
                onChange={(v) => setNotifications({ ...notifications, clubAnnouncementsEmail: v })}
                label="Email"
              />
              <Toggle
                checked={notifications.clubAnnouncementsPush}
                onChange={(v) => setNotifications({ ...notifications, clubAnnouncementsPush: v })}
                label="Push"
              />
            </div>
          </div>

          {/* Direct messages */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-[#0F172A]">Direct Messages & Connects</h4>
              <p className="text-xs text-gray-500">
                Notifications when fellow students or organizers message you or send invites
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Toggle
                checked={notifications.directMessagesEmail}
                onChange={(v) => setNotifications({ ...notifications, directMessagesEmail: v })}
                label="Email"
              />
              <Toggle
                checked={notifications.directMessagesPush}
                onChange={(v) => setNotifications({ ...notifications, directMessagesPush: v })}
                label="Push"
              />
            </div>
          </div>

          {/* Weekly digest */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-[#0F172A]">Weekly Campus Digest</h4>
              <p className="text-xs text-gray-500">
                Every Monday summary of trending events, student spotlights, and internships
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Toggle
                checked={notifications.weeklyDigestEmail}
                onChange={(v) => setNotifications({ ...notifications, weeklyDigestEmail: v })}
                label="Email"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Privacy & Security */}
      <Card padding="lg" className="space-y-5">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="text-base sm:text-lg font-bold text-[#0F172A]"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Privacy & Discovery
            </h2>
            <p className="text-xs text-gray-400">
              Control your visibility across campus student directories
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                Discoverable in People Directory
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Allow other verified students to discover your profile and send connection requests
              </p>
            </div>
            <Toggle
              checked={privacy.profileVisible}
              onChange={(v) => {
                setPrivacy({ ...privacy, profileVisible: v });
                toast(v ? 'Profile made visible in search' : 'Profile hidden from search', 'info');
              }}
            />
          </div>

          <div className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                Show Club Memberships on Profile
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Display the list of clubs and chapters you are an active member of
              </p>
            </div>
            <Toggle
              checked={privacy.showMemberships}
              onChange={(v) => setPrivacy({ ...privacy, showMemberships: v })}
            />
          </div>

          <div className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                Allow Direct Peer Messaging
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Permit students to message you without prior connection acceptance
              </p>
            </div>
            <Toggle
              checked={privacy.allowDirectMessages}
              onChange={(v) => setPrivacy({ ...privacy, allowDirectMessages: v })}
            />
          </div>
        </div>
      </Card>

      {/* 4. Appearance / Theme */}
      <Card padding="lg" className="space-y-5">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="text-base sm:text-lg font-bold text-[#0F172A]"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Interface Theme
            </h2>
            <p className="text-xs text-gray-400">
              Select your visual preference for the Klubrio student portal
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'system', label: 'System Default', icon: Monitor, desc: 'Follows operating system settings' },
            { id: 'light', label: 'Light Theme', icon: Sun, desc: 'Clean, high-contrast light mode' },
            { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Coming soon in next release' },
          ].map(({ id, label, icon: Icon, desc }) => {
            const isSelected = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTheme(id as 'system' | 'light' | 'dark');
                  toast(`Theme set to ${label}`, 'info');
                }}
                className={cn(
                  'p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer',
                  isSelected
                    ? 'border-[#6366F1] bg-[#6366F1]/5 ring-2 ring-[#6366F1]/20 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <Icon className={cn('w-5 h-5', isSelected ? 'text-[#6366F1]' : 'text-gray-400')} />
                  {isSelected && <Check className="w-4 h-4 text-[#6366F1]" />}
                </div>
                <div>
                  <h4 className={cn('text-sm font-bold', isSelected ? 'text-[#6366F1]' : 'text-[#0F172A]')}>
                    {label}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Save Button at Bottom */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="primary"
          size="md"
          loading={isSaving}
          onClick={handleSaveAll}
          icon={<Save className="w-4 h-4" />}
        >
          Save All Preferences
        </Button>
      </div>
    </div>
  );
}
