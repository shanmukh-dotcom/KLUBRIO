'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Upload, Camera } from 'lucide-react';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';

const INTERESTS = [
  { id: 'tech', label: 'Technology', icon: '💻' },
  { id: 'aiml', label: 'AI/ML', icon: '🤖' },
  { id: 'robotics', label: 'Robotics', icon: '🦾' },
  { id: 'design', label: 'Design', icon: '🎨' },
  { id: 'entrepreneurship', label: 'Entrepreneurship', icon: '🚀' },
  { id: 'arts', label: 'Arts', icon: '🎭' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'social_impact', label: 'Social Impact', icon: '❤️' },
  { id: 'others', label: 'Others', icon: '···' },
];

const BRANCHES = [
  { value: 'cse_aiml', label: 'CSE (AI & ML)' },
  { value: 'cse', label: 'CSE' },
  { value: 'ece', label: 'ECE' },
  { value: 'mech', label: 'Mechanical' },
  { value: 'civil', label: 'Civil' },
  { value: 'eee', label: 'EEE' },
  { value: 'it', label: 'Information Technology' },
  { value: 'data_sci', label: 'Data Science' },
  { value: 'other', label: 'Other' },
];

const YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5 MB.', 'error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast('Only JPG, PNG and WebP images are supported.', 'error');
      return;
    }
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  };

  const handleContinue = async () => {
    if (!fullName.trim()) {
      toast('Please enter your full name.', 'error');
      return;
    }
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    updateUser({
      fullName,
      branch: BRANCHES.find(b => b.value === branch)?.label,
      yearOfStudy: year ? parseInt(year) : undefined,
      interests: selectedInterests.map(id => INTERESTS.find(i => i.id === id)?.label ?? id),
      avatar: avatarUrl ?? undefined,
    });
    toast('Profile saved! Welcome to Klubrio!', 'success');
    router.push('/welcome');
  };

  const handleSkip = () => {
    router.push('/welcome');
  };

  return (
    <AuthLayout
      headline={<>
        <span style={{ color: '#0F172A' }}>Let&apos;s make your<br /></span>
        <span style={{ background: 'linear-gradient(90deg, #6366F1, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>campus journey<br />personal.</span>
      </>}
      subtext="Tell us a bit about yourself so we can recommend the right clubs, events and opportunities just for you."
      quote="Same people. New experiences. A campus that grows with you."
    >
      {/* Step indicator */}
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">STEP 3 OF 3</p>
        <div className="flex gap-1.5">
          <div className="h-1 w-12 rounded-full bg-[#6366F1]" />
          <div className="h-1 w-12 rounded-full bg-[#6366F1]" />
          <div className="h-1 w-12 rounded-full bg-[#6366F1]" />
        </div>
      </div>

      <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Complete your profile
      </h1>
      <p className="text-gray-500 text-sm mb-6">Add a few quick details to get the most out of Klubrio.</p>

      <div className="space-y-5">
        {/* Photo upload */}
        <div>
          <p className="text-sm font-medium text-[#0F172A] mb-3">Profile photo <span className="text-gray-400 font-normal">(optional)</span></p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#6366F1] rounded-full flex items-center justify-center hover:bg-[#5558e8] transition-colors"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-[#6366F1] hover:text-[#6366F1] transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Photo
              </button>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG (max 5MB)</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* Full name */}
        <Input
          label="Full name"
          type="text"
          placeholder="Your name"
          icon={<User className="w-4 h-4" />}
          value={fullName}
          onChange={e => setFullName(e.target.value)}
        />

        {/* Academic details */}
        <div>
          <p className="text-sm font-medium text-[#0F172A] mb-3">Academic details</p>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Branch / Program"
              options={BRANCHES}
              placeholder="Select your branch"
              value={branch}
              onChange={e => setBranch(e.target.value)}
            />
            <Select
              label="Year of study"
              options={YEARS}
              placeholder="Select year"
              value={year}
              onChange={e => setYear(e.target.value)}
            />
          </div>
        </div>

        {/* Interests */}
        <div>
          <p className="text-sm font-medium text-[#0F172A] mb-1">
            Interests <span className="text-gray-400 font-normal">(optional)</span>
          </p>
          <p className="text-xs text-gray-400 mb-3">Select a few that interest you. This helps us suggest relevant clubs and events.</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleInterest(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-200',
                  selectedInterests.includes(id)
                    ? 'bg-[#6366F1]/10 border-[#6366F1] text-[#6366F1]'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button fullWidth size="lg" loading={isLoading} onClick={handleContinue}>
          Continue →
        </Button>

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-sm font-semibold text-[#6366F1] hover:text-[#10B981] transition-colors underline underline-offset-2"
        >
          Skip for now
        </button>
      </div>
    </AuthLayout>
  );
}
