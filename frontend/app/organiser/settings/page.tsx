'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, Toggle } from '@/components/ui/index';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';

export default function OrganiserSettingsPage() {
  const { toast } = useToast();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [regNotifs, setRegNotifs] = useState(true);
  const [memberJoin, setMemberJoin] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Settings</h1>
        <p className="text-sm text-gray-500">Manage your club workspace settings.</p>
      </div>

      <div className="space-y-5">
        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Notifications</h3>
          <div className="space-y-4">
            <Toggle checked={emailNotifs} onChange={setEmailNotifs} label="Email notifications" description="Receive email notifications for registrations and updates" />
            <Toggle checked={regNotifs} onChange={setRegNotifs} label="New registration alerts" description="Get notified when someone registers for your events" />
            <Toggle checked={memberJoin} onChange={setMemberJoin} label="New member alerts" description="Get notified when someone joins your club" />
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Registration</h3>
          <div className="space-y-4">
            <Toggle checked={autoApprove} onChange={setAutoApprove} label="Auto-approve registrations" description="Automatically approve all event registrations (no manual review)" />
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Privacy</h3>
          <div className="space-y-4">
            <Toggle checked={publicProfile} onChange={setPublicProfile} label="Public club profile" description="Make your club visible in search and discovery" />
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Danger Zone</h3>
          <div className="flex items-center justify-between p-4 border border-red-100 rounded-xl bg-red-50/50">
            <div>
              <p className="text-sm font-medium text-red-700">Delete Club</p>
              <p className="text-xs text-red-500">This action is irreversible. All data will be permanently deleted.</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => toast('Delete club is disabled in demo mode.', 'error')}>Delete</Button>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => toast('Settings saved!', 'success')}>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
