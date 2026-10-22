'use client';

import React, { useState } from 'react';
import { Camera, Globe, Share2, Link2, AtSign, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, Avatar } from '@/components/ui/index';
import { useToast } from '@/lib/toast-context';

export default function ClubProfilePage() {
  const { toast } = useToast();
  const [name, setName] = useState('HARVEST');
  const [tagline, setTagline] = useState('AgriTech Innovation');
  const [description, setDescription] = useState('Hybrid AI and Robotics for Vitality Enhancement and Sustainable Transformation. We bridge technology and agriculture to build smarter, greener futures.');
  const [college, setCollege] = useState('Presidency University, Bangalore');
  const [category, setCategory] = useState('Technology');
  const [socials, setSocials] = useState({ instagram: '', twitter: '', linkedin: '', website: '' });

  const handleSave = () => toast('Club profile updated successfully!', 'success');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Club Profile</h1>
        <p className="text-sm text-gray-500">Manage your club&apos;s identity and public information.</p>
      </div>

      <div className="space-y-5">
        {/* Cover & Logo */}
        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4">Club Images</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#3B82F6]/20 flex items-center justify-center text-4xl">🌱</div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#6366F1] rounded-full flex items-center justify-center"><Camera className="w-3.5 h-3.5 text-white" /></button>
            </div>
            <div>
              <Button size="sm" variant="outline" icon={<Upload className="w-4 h-4" />}>Upload Logo</Button>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG (max 2 MB, square)</p>
            </div>
          </div>
        </Card>

        {/* Basic info */}
        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4">Basic Information</h3>
          <div className="space-y-3">
            <Input label="Club Name" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Tagline" value={tagline} onChange={e => setTagline(e.target.value)} />
            <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
            <Input label="College / University" value={college} onChange={e => setCollege(e.target.value)} />
            <Input label="Category" value={category} onChange={e => setCategory(e.target.value)} />
          </div>
        </Card>

        {/* Social */}
        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4">Social Links</h3>
          <div className="space-y-3">
            <Input label="Website" placeholder="https://" icon={<Globe className="w-4 h-4" />} value={socials.website} onChange={e => setSocials(s => ({ ...s, website: e.target.value }))} />
            <Input label="Instagram" placeholder="@yourclub" icon={<AtSign className="w-4 h-4" />} value={socials.instagram} onChange={e => setSocials(s => ({ ...s, instagram: e.target.value }))} />
            <Input label="Twitter" placeholder="@yourclub" icon={<Share2 className="w-4 h-4" />} value={socials.twitter} onChange={e => setSocials(s => ({ ...s, twitter: e.target.value }))} />
            <Input label="LinkedIn" placeholder="linkedin.com/in/yourclub" icon={<Link2 className="w-4 h-4" />} value={socials.linkedin} onChange={e => setSocials(s => ({ ...s, linkedin: e.target.value }))} />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary">Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
