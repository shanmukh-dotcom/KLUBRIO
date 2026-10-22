'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User as UserIcon,
  Mail,
  GraduationCap,
  Building2,
  Calendar,
  Award,
  Users,
  Edit3,
  ExternalLink,
  Download,
  Share2,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { Card, Badge, Avatar, Modal } from '@/components/ui/index';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { MOCK_CLUBS, MOCK_EVENTS, MOCK_CERTIFICATES } from '@/mocks/data';
import { cn } from '@/lib/utils';

export default function StudentProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  // Active student state (falling back to user context or student defaults)
  const student = {
    fullName: user?.fullName || 'Ballaya',
    email: user?.email || 'ballaya@example.com',
    college: user?.college || 'Presidency University',
    branch: user?.branch || 'CSE (AI & ML)',
    yearOfStudy: user?.yearOfStudy || 3,
    interests: user?.interests || ['Technology', 'AI/ML', 'Robotics', 'Entrepreneurship', 'Open Source'],
    bio: 'Third-year computer science student fascinated by deep learning, edge robotics, and campus startup culture. Currently building autonomous AgriTech sensor prototypes with HARVEST.',
  };

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: student.fullName,
    branch: student.branch,
    yearOfStudy: student.yearOfStudy,
    bio: student.bio,
    interestsInput: student.interests.join(', '),
  });
  const [isSaving, setIsSaving] = useState(false);

  // Clubs joined
  const joinedClubs = MOCK_CLUBS.filter((c) => c.isMember || c.id === 'club-1');

  // Attended / registered events
  const userEvents = MOCK_EVENTS.filter((e) => e.isRegistered || e.id === 'evt-2' || e.id === 'evt-1');

  // Earned certificates
  const userCertificates = MOCK_CERTIFICATES.filter((c) => c.status === 'valid');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const parsedInterests = formData.interestsInput
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean);

    setTimeout(() => {
      updateUser({
        fullName: formData.fullName,
        branch: formData.branch,
        yearOfStudy: Number(formData.yearOfStudy),
        interests: parsedInterests,
      });
      setIsSaving(false);
      setIsEditModalOpen(false);
      toast('Profile updated successfully!', 'success');
    }, 600);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Profile Header Banner Card */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white p-6 sm:p-8 shadow-lg overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          {/* Avatar with Glow */}
          <div className="relative">
            <div className="p-1 rounded-full bg-gradient-to-br from-[#6366F1] to-[#10B981] shadow-xl">
              <Avatar
                name={student.fullName}
                size="xl"
                className="w-24 h-24 sm:w-28 sm:h-28 text-2xl font-black border-4 border-[#0F172A]"
              />
            </div>
            <div className="absolute bottom-1 right-1 p-1 bg-emerald-500 rounded-full border-2 border-[#0F172A]" title="Active Student Status">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-extrabold text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {student.fullName}
                </h1>
                <p className="text-sm text-emerald-300 font-medium mt-0.5">
                  Verified Student Member
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Edit3 className="w-4 h-4" />}
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Edit Profile
                </Button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast('Public profile link copied!', 'info');
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Share profile"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* University & Degree meta badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2 text-xs sm:text-sm text-gray-300">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#6366F1]" />
                {student.college}
              </span>
              <span className="hidden sm:inline text-gray-600">•</span>
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                {student.branch} (Year {student.yearOfStudy})
              </span>
              <span className="hidden sm:inline text-gray-600">•</span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-400" />
                {student.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1/3) */}
        <div className="space-y-6">
          {/* About Section */}
          <Card padding="md" className="space-y-3">
            <h3
              className="text-base font-bold text-[#0F172A] flex items-center gap-2"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <UserIcon className="w-4 h-4 text-[#6366F1]" />
              About Me
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {student.bio}
            </p>
          </Card>

          {/* Interests & Skills */}
          <Card padding="md" className="space-y-3">
            <h3
              className="text-base font-bold text-[#0F172A] flex items-center gap-2"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Interests & Domains
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {student.interests.map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-1 rounded-full bg-indigo-50 text-[#6366F1] font-semibold text-xs border border-indigo-100"
                >
                  {interest}
                </span>
              ))}
            </div>
          </Card>

          {/* Joined Clubs */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3
                className="text-base font-bold text-[#0F172A] flex items-center gap-2"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                <Users className="w-4 h-4 text-blue-600" />
                My Clubs ({joinedClubs.length})
              </h3>
              <Link
                href="/student/clubs"
                className="text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5]"
              >
                View all
              </Link>
            </div>

            <div className="space-y-2 pt-1">
              {joinedClubs.map((club) => (
                <div
                  key={club.id}
                  className="p-3 rounded-xl bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                      🌱
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#0F172A] truncate">{club.name}</h4>
                      <p className="text-[11px] text-gray-400 truncate">{club.tagline}</p>
                    </div>
                  </div>
                  <Badge variant="teal" className="text-[10px]">
                    Member
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Registered & Attended Events */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3
                  className="text-base font-bold text-[#0F172A] flex items-center gap-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  <Calendar className="w-4 h-4 text-[#6366F1]" />
                  Events & Activities
                </h3>
                <p className="text-xs text-gray-400">Events registered, attending, or completed</p>
              </div>

              <Link
                href="/student/events"
                className="text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5] flex items-center gap-1"
              >
                All Events <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {userEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="violet" className="text-[10px]">
                        {evt.category}
                      </Badge>
                      <span className="text-xs text-gray-400 font-medium">
                        {evt.date} • {evt.startTime}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#0F172A] truncate">{evt.title}</h4>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {evt.venue}
                      </span>
                      <span>•</span>
                      <span>Hosted by {evt.clubName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Confirmed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Certificates Earned */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3
                  className="text-base font-bold text-[#0F172A] flex items-center gap-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  <Award className="w-4 h-4 text-amber-500" />
                  Verified Certificates & Credentials
                </h3>
                <p className="text-xs text-gray-400">
                  Cryptographically verified certificates of participation and merit
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {userCertificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/50 via-white to-gray-50 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0">
                      🎖️
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#0F172A] truncate">
                          {cert.eventName}
                        </h4>
                        <Badge variant="yellow" className="text-[10px]">
                          {cert.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{cert.clubName}</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-1">
                        ID: {cert.certificateId} • Issued {cert.issueDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Download className="w-3.5 h-3.5 text-gray-600" />}
                      onClick={() => toast(`Downloaded certificate ${cert.certificateId}`, 'success')}
                      className="text-xs"
                    >
                      PDF
                    </Button>
                    {cert.verificationUrl && (
                      <a
                        href={cert.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-[#6366F1] transition-colors"
                        title="Verify Certificate URL"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile Information"
        size="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />

          <Input
            label="Branch / Department"
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            required
          />

          <Input
            label="Year of Study"
            type="number"
            min={1}
            max={5}
            value={formData.yearOfStudy}
            onChange={(e) => setFormData({ ...formData, yearOfStudy: Number(e.target.value) })}
            required
          />

          <Textarea
            label="About / Bio"
            rows={3}
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          />

          <Input
            label="Interests (comma separated)"
            value={formData.interestsInput}
            onChange={(e) => setFormData({ ...formData, interestsInput: e.target.value })}
            hint="e.g. AI/ML, Robotics, Web Development, Design"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
