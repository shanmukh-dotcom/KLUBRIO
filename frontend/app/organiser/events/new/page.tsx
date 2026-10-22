'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Type,
  AlignLeft,
  Mail,
  Phone,
  ListFilter,
  CircleDot,
  CheckSquare,
  Calendar,
  UploadCloud,
  Users,
  GripVertical,
  MoreVertical,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Monitor,
  Smartphone,
  Eye,
  Bookmark,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  Tag,
  ShieldCheck,
  HelpCircle,
  AlertCircle,
  FileText,
  Sliders,
  Send,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Card, Toggle, Modal } from '@/components/ui/index';
import type { FormField, FieldType } from '@/types';
import { useToast } from '@/lib/toast-context';
import { KlubrioLogo } from '@/components/ui/logo';

// ============================================================
// CONFIGURATION & DEFINITIONS
// ============================================================

interface FieldTypeConfig {
  type: FieldType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultLabel: string;
  defaultPlaceholder?: string;
  defaultOptions?: string[];
  category: 'text' | 'contact' | 'choice' | 'advanced';
}

const FIELD_TYPE_CONFIGS: FieldTypeConfig[] = [
  {
    type: 'short_answer',
    label: 'Short Answer',
    description: 'Single line text response',
    icon: Type,
    defaultLabel: 'Question Title',
    defaultPlaceholder: 'Enter your answer here...',
    category: 'text',
  },
  {
    type: 'long_answer',
    label: 'Long Answer',
    description: 'Paragraph or multiline response',
    icon: AlignLeft,
    defaultLabel: 'Detailed Explanation',
    defaultPlaceholder: 'Type your detailed response...',
    category: 'text',
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Student or institutional email',
    icon: Mail,
    defaultLabel: 'Email Address',
    defaultPlaceholder: 'student@presidencyuniversity.in',
    category: 'contact',
  },
  {
    type: 'phone',
    label: 'Phone Number',
    description: 'Contact number with country code',
    icon: Phone,
    defaultLabel: 'Phone Number',
    defaultPlaceholder: '+91 98765 43210',
    category: 'contact',
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    description: 'Single selection from a dropdown list',
    icon: ListFilter,
    defaultLabel: 'Select Option',
    defaultOptions: ['Option 1', 'Option 2', 'Option 3'],
    category: 'choice',
  },
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    description: 'Single selection radio buttons',
    icon: CircleDot,
    defaultLabel: 'Choose One',
    defaultOptions: ['Yes', 'No'],
    category: 'choice',
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    description: 'Multi-select checkbox options',
    icon: CheckSquare,
    defaultLabel: 'Select all that apply',
    defaultOptions: ['Option A', 'Option B', 'Option C'],
    category: 'choice',
  },
  {
    type: 'date',
    label: 'Date',
    description: 'Date picker input',
    icon: Calendar,
    defaultLabel: 'Date of Birth / Slot Date',
    defaultPlaceholder: 'Select date',
    category: 'advanced',
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Resume, ID card, or document (max 10MB)',
    icon: UploadCloud,
    defaultLabel: 'Upload Document / ID Card',
    category: 'advanced',
  },
  {
    type: 'team_registration',
    label: 'Team Registration',
    description: 'Team name and roster details',
    icon: Users,
    defaultLabel: 'Team Information',
    defaultPlaceholder: 'Enter team name',
    category: 'advanced',
  },
];

// Pre-populated initial form fields matching the specification
const INITIAL_FIELDS: FormField[] = [
  {
    id: 'field-1',
    type: 'short_answer',
    label: 'Full Name',
    placeholder: 'e.g. Alex Kumar',
    required: true,
  },
  {
    id: 'field-2',
    type: 'email',
    label: 'Email Address',
    placeholder: 'student@presidencyuniversity.in',
    required: true,
  },
  {
    id: 'field-3',
    type: 'phone',
    label: 'Phone Number',
    placeholder: '+91 98765 43210',
    required: true,
  },
  {
    id: 'field-4',
    type: 'dropdown',
    label: 'College / University',
    required: true,
    options: [
      'Presidency University (Bangalore)',
      'IIT Bombay',
      'IIT Delhi',
      'BITS Pilani',
      'Other (Specify)',
    ],
  },
  {
    id: 'field-5',
    type: 'dropdown',
    label: 'Year of Study',
    required: true,
    options: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  },
  {
    id: 'field-6',
    type: 'dropdown',
    label: 'Branch / Program',
    required: true,
    options: [
      'CSE (AI & ML)',
      'CSE',
      'ECE',
      'MECH',
      'Civil Engineering',
      'Other',
    ],
  },
  {
    id: 'field-7',
    type: 'multiple_choice',
    label: 'Do you want to participate as a team?',
    required: true,
    options: ['Yes', 'No'],
  },
];

const PRESET_COVERS = [
  {
    id: 'agritech',
    label: 'AgriTech Green',
    url: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'tech',
    label: 'AI & Robotics',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'hackathon',
    label: 'Code Sprint',
    url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'design',
    label: 'Design Nexus',
    url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80',
  },
];

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();

  // 4-step stepper state: default active is step 2 (Registration Form)
  const [currentStep, setCurrentStep] = useState<number>(2);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);

  // Step 1: Event Details
  const [eventData, setEventData] = useState({
    title: 'AgriTech Workshop Series',
    tagline: 'Hands-on Innovation for Smart & Sustainable Agriculture',
    club: 'HARVEST',
    category: 'Technology',
    description:
      'Join us for an intensive hands-on workshop exploring the intersection of IoT sensors, robotics, and AI in sustainable agriculture. Learn directly from leading industry mentors, build real-time monitoring solutions, and showcase your prototype in the final pitch showcase.',
    date: '2026-10-18',
    startTime: '10:00',
    endTime: '13:00',
    venue: 'E Block, Seminar Hall 2',
    venueType: 'in-person' as 'in-person' | 'virtual' | 'hybrid',
    capacity: 100,
    coverImage: PRESET_COVERS[0].url,
    tags: ['AgriTech', 'IoT', 'AI & Robotics', 'Sustainability'],
    newTag: '',
  });

  // Step 2: Form Builder Fields
  const [fields, setFields] = useState<FormField[]>(INITIAL_FIELDS);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>('');
  const [addingOptionFieldId, setAddingOptionFieldId] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState<string>('');
  const [openMenuFieldId, setOpenMenuFieldId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Step 3: Settings & Eligibility
  const [settings, setSettings] = useState({
    hasDeadline: true,
    deadlineDate: '2026-10-17',
    deadlineTime: '23:59',
    autoApproval: true,
    allowTeams: true,
    minTeamSize: 2,
    maxTeamSize: 4,
    eligibilityScope: 'all' as 'all' | 'restricted',
    allowedYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    allowedBranches: ['CSE (AI & ML)', 'CSE', 'ECE', 'MECH', 'Civil Engineering'],
    enableWaitlist: true,
    waitlistLimit: 30,
    sendEmailConfirmation: true,
    sendReminderNotification: true,
  });

  // Interactive Student Preview Form State
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // ------------------------------------------------------------
  // STEPPER NAVIGATION
  // ------------------------------------------------------------
  const steps = [
    { number: 1, label: 'Event Details', description: 'Core information & schedule' },
    { number: 2, label: 'Registration Form', description: 'Custom fields & questions' },
    { number: 3, label: 'Settings & Eligibility', description: 'Approvals & restrictions' },
    { number: 4, label: 'Review & Publish', description: 'Final check & launch' },
  ];

  const handleStepClick = (stepNum: number) => {
    setCurrentStep(stepNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    const next = Math.min(4, currentStep + 1);
    setCurrentStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    const prev = Math.max(1, currentStep - 1);
    setCurrentStep(prev);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------------------------------------------------------------
  // FORM BUILDER HANDLERS
  // ------------------------------------------------------------
  const handleAddField = (config: FieldTypeConfig) => {
    const newField: FormField = {
      id: `field-${generateId()}`,
      type: config.type,
      label: config.defaultLabel,
      required: true,
      placeholder: config.defaultPlaceholder,
      options: config.defaultOptions ? [...config.defaultOptions] : undefined,
    };
    setFields(prev => [...prev, newField]);
    toast(`Added "${config.label}" field to form`, 'success');
  };

  const handleDeleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setOpenMenuFieldId(null);
    toast('Field removed', 'info');
  };

  const handleDuplicateField = (id: string) => {
    const targetIndex = fields.findIndex(f => f.id === id);
    if (targetIndex === -1) return;
    const target = fields[targetIndex];
    const cloned: FormField = {
      ...target,
      id: `field-${generateId()}`,
      label: `${target.label} (Copy)`,
      options: target.options ? [...target.options] : undefined,
    };
    const nextFields = [...fields];
    nextFields.splice(targetIndex + 1, 0, cloned);
    setFields(nextFields);
    setOpenMenuFieldId(null);
    toast('Field duplicated', 'success');
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setFields(updated);
  };

  const handleToggleRequired = (id: string) => {
    setFields(prev =>
      prev.map(f => (f.id === id ? { ...f, required: !f.required } : f))
    );
  };

  const handleStartEditLabel = (field: FormField) => {
    setEditingFieldId(field.id);
    setEditingLabel(field.label);
    setOpenMenuFieldId(null);
  };

  const handleSaveEditLabel = (id: string) => {
    if (editingLabel.trim()) {
      setFields(prev =>
        prev.map(f => (f.id === id ? { ...f, label: editingLabel.trim() } : f))
      );
    }
    setEditingFieldId(null);
  };

  const handleAddOption = (fieldId: string) => {
    if (!newOptionValue.trim()) return;
    setFields(prev =>
      prev.map(f => {
        if (f.id === fieldId) {
          const existing = f.options || [];
          return { ...f, options: [...existing, newOptionValue.trim()] };
        }
        return f;
      })
    );
    setNewOptionValue('');
    setAddingOptionFieldId(null);
  };

  const handleRemoveOption = (fieldId: string, optionIndex: number) => {
    setFields(prev =>
      prev.map(f => {
        if (f.id === fieldId && f.options) {
          const nextOptions = f.options.filter((_, idx) => idx !== optionIndex);
          return { ...f, options: nextOptions };
        }
        return f;
      })
    );
  };

  const handleSaveDraft = () => {
    toast('Draft saved successfully to your club dashboard', 'success');
  };

  const handleConfirmPublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setPublishModalOpen(false);
      setIsPublished(true);
      toast('🎉 Event published successfully! Registrations are now live.', 'success');
    }, 1200);
  };

  // Helper to get field icon
  const getFieldIcon = (type: FieldType) => {
    const cfg = FIELD_TYPE_CONFIGS.find(c => c.type === type);
    const IconComponent = cfg ? cfg.icon : Type;
    return <IconComponent className="w-4 h-4" />;
  };

  // Helper to format field type label
  const getFieldTypeBadgeLabel = (type: FieldType) => {
    switch (type) {
      case 'short_answer':
        return 'SHORT ANSWER';
      case 'long_answer':
        return 'LONG ANSWER';
      case 'email':
        return 'EMAIL';
      case 'phone':
        return 'PHONE';
      case 'dropdown':
        return 'DROPDOWN';
      case 'multiple_choice':
        return 'MULTIPLE CHOICE';
      case 'checkbox':
        return 'CHECKBOXES';
      case 'date':
        return 'DATE';
      case 'file_upload':
        return 'FILE UPLOAD';
      case 'team_registration':
        return 'TEAM REGISTRATION';
      default:
        return 'CUSTOM';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* ── BREADCRUMB & HEADER SECTION ── */}
      <section className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3" aria-label="Breadcrumb">
            <Link
              href="/organiser/events"
              className="hover:text-[#6366F1] flex items-center gap-1.5 transition-colors font-medium"
            >
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>Events</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[#0F172A] font-semibold">Create Event</span>
          </nav>

          {/* Title Header with Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1
                  className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Create Event
                </h1>
                <Badge variant="teal" className="text-xs">
                  {eventData.club}
                </Badge>
                <span className="text-xs text-gray-400 font-medium hidden sm:inline">
                  Step {currentStep} of 4 • {steps[currentStep - 1].label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure your event details, build customized registration questions, set criteria, and publish to campus.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                icon={<Bookmark className="w-4 h-4 text-gray-600" />}
                onClick={handleSaveDraft}
              >
                Save as Draft
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={<Eye className="w-4 h-4 text-[#6366F1]" />}
                onClick={() => setPreviewModalOpen(true)}
              >
                Preview
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Sparkles className="w-4 h-4 text-white" />}
                onClick={() => setPublishModalOpen(true)}
              >
                Publish Event
              </Button>
            </div>
          </div>

          {/* ── 4-STEP STEPPER ── */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {steps.map(step => {
                const isCompleted = completedSteps.includes(step.number);
                const isActive = currentStep === step.number;
                const isPast = step.number < currentStep;

                return (
                  <button
                    key={step.number}
                    onClick={() => handleStepClick(step.number)}
                    className={cn(
                      'group flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 relative',
                      isActive
                        ? 'bg-gradient-to-r from-[#6366F1]/10 to-[#10B981]/5 border-[#6366F1] shadow-sm ring-2 ring-[#6366F1]/20'
                        : isCompleted || isPast
                        ? 'bg-white border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {/* Step Icon / Indicator */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                        isActive
                          ? 'bg-[#6366F1] text-white shadow-md'
                          : isCompleted || isPast
                          ? 'bg-[#10B981] text-white'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                      )}
                    >
                      {isCompleted || isPast ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        step.number
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-xs font-semibold uppercase tracking-wider',
                            isActive ? 'text-[#6366F1]' : 'text-gray-400'
                          )}
                        >
                          Step {step.number}
                        </span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-ping" />
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          isActive
                            ? 'text-[#0F172A]'
                            : isCompleted || isPast
                            ? 'text-gray-800'
                            : 'text-gray-600'
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── STEP CONTENT AREA ── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ============================================================ */}
        {/* STEP 1: EVENT DETAILS */}
        {/* ============================================================ */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in-50 duration-300">
            <Card padding="lg" className="border-gray-200 shadow-sm">
              <div className="border-b border-gray-100 pb-5 mb-6">
                <h2
                  className="text-xl font-bold text-[#0F172A]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Event Basics
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Provide primary information about the event for participants to discover.
                </p>
              </div>

              <div className="space-y-6">
                {/* Event Title */}
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Event Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={eventData.title}
                    onChange={e => setEventData({ ...eventData, title: e.target.value })}
                    placeholder="e.g. AgriTech Workshop Series 2026"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-medium"
                  />
                </div>

                {/* Tagline / Subtitle */}
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Short Tagline / Catchphrase
                  </label>
                  <input
                    type="text"
                    value={eventData.tagline}
                    onChange={e => setEventData({ ...eventData, tagline: e.target.value })}
                    placeholder="e.g. Hands-on Innovation for Smart & Sustainable Agriculture"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                  />
                </div>

                {/* Club & Category Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Organizing Club
                    </label>
                    <select
                      value={eventData.club}
                      onChange={e => setEventData({ ...eventData, club: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                    >
                      <option value="HARVEST">HARVEST (AgriTech Innovation)</option>
                      <option value="TechSphere">TechSphere</option>
                      <option value="Design Nexus">Design Nexus</option>
                      <option value="Sports Club">Sports Club</option>
                      <option value="AI & Robotics Club">AI & Robotics Club</option>
                      <option value="Entrepreneurship Cell">Entrepreneurship Cell</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Category
                    </label>
                    <select
                      value={eventData.category}
                      onChange={e => setEventData({ ...eventData, category: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                    >
                      <option value="Technology">Technology & Coding</option>
                      <option value="Design">Design & Creative</option>
                      <option value="Entrepreneurship">Entrepreneurship & Startups</option>
                      <option value="Sports">Sports & Fitness</option>
                      <option value="Arts">Arts & Culture</option>
                      <option value="Social Impact">Social Impact & Community</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Event Description & Agenda
                  </label>
                  <textarea
                    rows={4}
                    value={eventData.description}
                    onChange={e => setEventData({ ...eventData, description: e.target.value })}
                    placeholder="Explain what the event is about, what participants will learn, perks, certificates, prerequisites..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all leading-relaxed"
                  />
                </div>

                {/* Date and Time Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Event Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={eventData.date}
                        onChange={e => setEventData({ ...eventData, date: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={eventData.startTime}
                        onChange={e => setEventData({ ...eventData, startTime: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      End Time
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={eventData.endTime}
                        onChange={e => setEventData({ ...eventData, endTime: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Venue and Capacity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Venue / Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={eventData.venue}
                        onChange={e => setEventData({ ...eventData, venue: e.target.value })}
                        placeholder="e.g. E Block, Seminar Hall 2, Presidency University"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Capacity Limit
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="1"
                        value={eventData.capacity}
                        onChange={e =>
                          setEventData({ ...eventData, capacity: parseInt(e.target.value) || 0 })
                        }
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Cover Image Upload / Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Event Cover Banner
                  </label>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 mb-3 h-48 bg-gray-100 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={eventData.coverImage}
                      alt="Event Cover Preview"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                      <p className="text-white text-xs font-medium">
                        Current banner: {eventData.title}
                      </p>
                    </div>
                  </div>

                  {/* Preset Banner Selector */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Quick Presets:
                    </span>
                    {PRESET_COVERS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEventData({ ...eventData, coverImage: preset.url })}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                          eventData.coverImage === preset.url
                            ? 'bg-[#6366F1] text-white border-[#6366F1]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="flex items-center justify-between border-t border-gray-100 mt-8 pt-6">
                <Button
                  variant="ghost"
                  icon={<Bookmark className="w-4 h-4" />}
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  iconRight={<ChevronRight className="w-4 h-4" />}
                  onClick={handleNextStep}
                >
                  Continue to Registration Form
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: REGISTRATION FORM BUILDER (3-COLUMN LAYOUT) */}
        {/* ============================================================ */}
        {currentStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ────────────────────────────────────────────────────────── */}
            {/* COLUMN 1 (LEFT): FIELD TYPES SIDEBAR (lg:col-span-3) */}
            {/* ────────────────────────────────────────────────────────── */}
            <aside className="lg:col-span-3 space-y-4">
              <Card padding="md" className="border-gray-200 shadow-sm sticky top-20">
                <div className="border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-bold">
                        <Plus className="w-4 h-4" />
                      </div>
                      <h3
                        className="text-base font-bold text-[#0F172A]"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        Field Types
                      </h3>
                    </div>
                    <Badge variant="violet" className="text-[10px]">
                      {FIELD_TYPE_CONFIGS.length} Types
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Click any field type below to append it to your registration form.
                  </p>
                </div>

                {/* List of 10 Field Types */}
                <div className="space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                  {FIELD_TYPE_CONFIGS.map(config => {
                    const IconComponent = config.icon;
                    return (
                      <button
                        key={config.type}
                        type="button"
                        onClick={() => handleAddField(config)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-[#6366F1]/40 hover:bg-[#6366F1]/5 transition-all duration-150 text-left group bg-white shadow-xs"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-[#6366F1] group-hover:text-white text-gray-600 flex items-center justify-center shrink-0 transition-colors">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#0F172A] group-hover:text-[#6366F1] transition-colors">
                            {config.label}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {config.description}
                          </p>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 text-[#6366F1] text-xs font-bold transition-opacity">
                          + Add
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Quick Helper Note */}
                <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 leading-snug">
                      <strong>Pro tip:</strong> You can edit labels inline, toggle required status, and reorder fields using the arrow buttons.
                    </p>
                  </div>
                </div>
              </Card>
            </aside>

            {/* ────────────────────────────────────────────────────────── */}
            {/* COLUMN 2 (CENTER): REGISTRATION FORM AREA (lg:col-span-5) */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="lg:col-span-5 space-y-4">
              <Card padding="md" className="border-gray-200 shadow-sm">
                {/* Header Subtitle Area */}
                <div className="border-b border-gray-100 pb-4 mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2
                        className="text-lg font-bold text-[#0F172A]"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        Registration Form
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Add and customize the fields you want to collect from participants
                      </p>
                    </div>
                    <Badge variant="teal" className="text-xs font-semibold">
                      {fields.length} {fields.length === 1 ? 'Field' : 'Fields'}
                    </Badge>
                  </div>

                  {/* Add Field Button */}
                  <div className="flex items-center justify-between gap-2 mt-4">
                    <span className="text-xs text-gray-400 font-medium">
                      {fields.filter(f => f.required).length} required • {fields.filter(f => !f.required).length} optional
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => handleAddField(FIELD_TYPE_CONFIGS[0])}
                    >
                      + Add Field
                    </Button>
                  </div>
                </div>

                {/* Empty State */}
                {fields.length === 0 && (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-2xl">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-gray-700">No fields added yet</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                      Choose a field type from the left sidebar to add questions to your event form.
                    </p>
                  </div>
                )}

                {/* Current Fields List */}
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const isDropdownOrChoice =
                      field.type === 'dropdown' ||
                      field.type === 'multiple_choice' ||
                      field.type === 'checkbox';

                    const isEditingThisLabel = editingFieldId === field.id;

                    return (
                      <div
                        key={field.id}
                        className={cn(
                          'group bg-white border rounded-2xl p-4 transition-all duration-200 relative shadow-xs hover:border-[#6366F1]/50 hover:shadow-sm',
                          isEditingThisLabel
                            ? 'border-[#6366F1] ring-2 ring-[#6366F1]/20'
                            : 'border-gray-200'
                        )}
                      >
                        {/* Top bar of field: Drag handle, Icon, Label, Required, 3-dot Menu */}
                        <div className="flex items-start gap-2.5">
                          {/* Drag Handle (Visual only grip dots) */}
                          <div
                            className="cursor-grab text-gray-300 hover:text-gray-500 pt-1 shrink-0 select-none"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          {/* Field Type Icon */}
                          <div className="w-7 h-7 rounded-lg bg-gray-100 text-[#6366F1] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                            {getFieldIcon(field.type)}
                          </div>

                          {/* Field Label + Type Label */}
                          <div className="flex-1 min-w-0">
                            {isEditingThisLabel ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingLabel}
                                  onChange={e => setEditingLabel(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveEditLabel(field.id);
                                    if (e.key === 'Escape') setEditingFieldId(null);
                                  }}
                                  className="w-full text-sm font-semibold px-2 py-1 rounded-lg border border-[#6366F1] focus:outline-none focus:ring-1 focus:ring-[#6366F1] bg-white text-[#0F172A]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditLabel(field.id)}
                                  className="p-1 rounded-md bg-[#10B981] text-white hover:bg-[#10B981]/90"
                                  title="Save label"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFieldId(null)}
                                  className="p-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLabel(field)}
                                  className="text-left font-semibold text-sm text-[#0F172A] hover:text-[#6366F1] flex items-center gap-1.5 transition-colors group/edit"
                                >
                                  <span>{field.label}</span>
                                  <Edit2 className="w-3 h-3 text-gray-300 group-hover/edit:text-[#6366F1] transition-colors" />
                                </button>
                              </div>
                            )}

                            {/* Type Label in Uppercase */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {getFieldTypeBadgeLabel(field.type)}
                              </span>
                              {field.placeholder && (
                                <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                                  • {field.placeholder}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Required Status Toggle Badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleRequired(field.id)}
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all shrink-0',
                              field.required
                                ? 'bg-indigo-50 text-[#6366F1] border-indigo-200 hover:bg-indigo-100'
                                : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                            )}
                            title="Click to toggle required status"
                          >
                            {field.required ? 'Required *' : 'Optional'}
                          </button>

                          {/* Reorder Buttons */}
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveField(index, 'up')}
                              className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent text-gray-500"
                              title="Move field up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === fields.length - 1}
                              onClick={() => handleMoveField(index, 'down')}
                              className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent text-gray-500 border-l border-gray-200"
                              title="Move field down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Three-Dot Menu */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuFieldId(openMenuFieldId === field.id ? null : field.id)
                              }
                              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title="Field options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu Popup */}
                            {openMenuFieldId === field.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-30 animate-in fade-in-50 zoom-in-95">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLabel(field)}
                                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                                  Edit Label
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateField(field.id)}
                                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                                  Duplicate Field
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleRequired(field.id)}
                                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                                >
                                  <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
                                  {field.required ? 'Mark as Optional' : 'Mark as Required'}
                                </button>
                                <div className="h-px bg-gray-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField(field.id)}
                                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  Delete Field
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Options Chips for Dropdown, Multiple Choice, and Checkboxes */}
                        {isDropdownOrChoice && (
                          <div className="mt-3 pl-8 pt-3 border-t border-gray-100">
                            <p className="text-[11px] font-semibold text-gray-500 mb-2">
                              Options:
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {field.options?.map((opt, optIdx) => (
                                <span
                                  key={optIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 group/chip"
                                >
                                  <span className="truncate max-w-[180px]">{opt}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(field.id, optIdx)}
                                    className="text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-200 p-0.5 transition-colors"
                                    title="Remove option"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}

                              {/* Add Option Trigger / Input */}
                              {addingOptionFieldId === field.id ? (
                                <div className="inline-flex items-center gap-1 bg-white border border-[#6366F1] rounded-lg p-0.5">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Type option name..."
                                    value={newOptionValue}
                                    onChange={e => setNewOptionValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleAddOption(field.id);
                                      if (e.key === 'Escape') setAddingOptionFieldId(null);
                                    }}
                                    className="px-2 py-0.5 text-xs text-[#0F172A] focus:outline-none w-36"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddOption(field.id)}
                                    className="p-1 rounded bg-[#6366F1] text-white hover:bg-[#6366F1]/90"
                                    title="Add"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddingOptionFieldId(null)}
                                    className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    title="Cancel"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingOptionFieldId(field.id);
                                    setNewOptionValue('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-[#6366F1] hover:text-[#6366F1] text-xs font-medium transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Option</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Navigation within Card */}
                <div className="flex items-center justify-between border-t border-gray-100 mt-6 pt-5">
                  <Button
                    variant="ghost"
                    icon={<ChevronLeft className="w-4 h-4" />}
                    onClick={handlePrevStep}
                  >
                    Back to Details
                  </Button>
                  <Button
                    variant="primary"
                    iconRight={<ChevronRight className="w-4 h-4" />}
                    onClick={handleNextStep}
                  >
                    Continue to Settings & Eligibility
                  </Button>
                </div>
              </Card>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* COLUMN 3 (RIGHT): FORM PREVIEW PANEL (lg:col-span-4) */}
            {/* ────────────────────────────────────────────────────────── */}
            <aside className="lg:col-span-4 space-y-4">
              <div className="sticky top-20">
                {/* Header with Desktop/Mobile Toggle */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3
                        className="text-base font-bold text-[#0F172A]"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        Form Preview
                      </h3>
                    </div>

                    {/* Desktop / Mobile Switcher */}
                    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                          previewDevice === 'desktop'
                            ? 'bg-white text-[#6366F1] shadow-xs'
                            : 'text-gray-500 hover:text-[#0F172A]'
                        )}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Desktop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                          previewDevice === 'mobile'
                            ? 'bg-white text-[#6366F1] shadow-xs'
                            : 'text-gray-500 hover:text-[#0F172A]'
                        )}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Mobile</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Live student registration experience. Updates automatically.
                  </p>
                </div>

                {/* ── PREVIEW CONTAINER ── */}
                {previewDevice === 'mobile' ? (
                  /* Mobile Device Frame Mockup */
                  <div className="max-w-[340px] mx-auto bg-gray-900 p-2.5 rounded-[40px] shadow-2xl border-4 border-gray-800">
                    {/* Speaker notch */}
                    <div className="w-24 h-4 bg-gray-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-black/60 mr-2" />
                      <div className="w-8 h-1 rounded-full bg-gray-700" />
                    </div>

                    {/* Screen inner content */}
                    <div className="bg-white rounded-[30px] overflow-hidden max-h-[600px] overflow-y-auto text-xs">
                      {/* Mobile Event Info Header */}
                      <div className="bg-gradient-to-br from-[#6366F1] to-[#10B981] p-4 text-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                            {eventData.club}
                          </span>
                          <span className="text-[10px] text-white/80">Presidency Univ</span>
                        </div>
                        <h4 className="font-extrabold text-sm leading-tight mb-1">
                          {eventData.title}
                        </h4>
                        <div className="space-y-0.5 text-[11px] text-white/90">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {eventData.date} • {eventData.startTime}
                          </p>
                          <p className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {eventData.venue}
                          </p>
                        </div>
                      </div>

                      {/* Mobile Fields List */}
                      <div className="p-4 space-y-3.5">
                        <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                          Participant Details
                        </p>
                        {fields.map(field => (
                          <div key={field.id} className="space-y-1">
                            <label className="block font-semibold text-gray-800 text-[11px]">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            {renderPreviewFieldInput(field, previewAnswers, setPreviewAnswers, true)}
                          </div>
                        ))}

                        <div className="pt-2">
                          <button
                            type="button"
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#10B981] text-white font-bold text-xs shadow-md active:scale-95 transition-transform"
                          >
                            Submit & Register
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Desktop Container */
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-h-[calc(100vh-230px)] overflow-y-auto">
                    {/* Event Info Header */}
                    <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white p-5 relative overflow-hidden">
                      <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-40 h-40 bg-gradient-to-br from-[#6366F1]/30 to-[#10B981]/30 rounded-full blur-2xl pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[#10B981] text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                            {eventData.club}
                          </span>
                          <span className="text-xs text-gray-300">• Presidency University</span>
                        </div>

                        <h3
                          className="text-lg font-bold text-white tracking-tight leading-snug mb-2"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          {eventData.title}
                        </h3>

                        <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>
                              {eventData.date} • {eventData.startTime} - {eventData.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#6366F1]" />
                            <span className="truncate">{eventData.venue}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Registration Form Body */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Registration Form
                        </h4>
                        <span className="text-[11px] text-gray-400">
                          * indicates required field
                        </span>
                      </div>

                      {fields.map(field => (
                        <div key={field.id} className="space-y-1.5">
                          <label className="block text-xs font-semibold text-[#0F172A]">
                            {field.label}{' '}
                            {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {renderPreviewFieldInput(
                            field,
                            previewAnswers,
                            setPreviewAnswers,
                            false
                          )}
                        </div>
                      ))}

                      {/* Mock Submit Button */}
                      <div className="pt-4 border-t border-gray-100">
                        <button
                          type="button"
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#10B981] text-white font-bold text-sm shadow-md hover:opacity-95 transition-all"
                        >
                          Complete Registration
                        </button>
                        <p className="text-[10px] text-gray-400 text-center mt-2">
                          By clicking Register, you confirm your attendance at {eventData.club}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: SETTINGS & ELIGIBILITY */}
        {/* ============================================================ */}
        {currentStep === 3 && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in-50 duration-300">
            <Card padding="lg" className="border-gray-200 shadow-sm space-y-8">
              <div className="border-b border-gray-100 pb-5">
                <h2
                  className="text-xl font-bold text-[#0F172A]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Settings & Eligibility Rules
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Control who can participate, team configurations, approval workflows, and limits.
                </p>
              </div>

              {/* 1. Registration Deadline */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Registration Deadline</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Automatically closes registrations when deadline is reached.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.hasDeadline}
                    onChange={v => setSettings({ ...settings, hasDeadline: v })}
                  />
                </div>

                {settings.hasDeadline && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Deadline Date
                      </label>
                      <input
                        type="date"
                        value={settings.deadlineDate}
                        onChange={e =>
                          setSettings({ ...settings, deadlineDate: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#6366F1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Deadline Time
                      </label>
                      <input
                        type="time"
                        value={settings.deadlineTime}
                        onChange={e =>
                          setSettings({ ...settings, deadlineTime: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#6366F1]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Auto-Approval Workflow */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Auto-Approval & Ticket Generation
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      If enabled, registrations are approved immediately and QR entry passes are generated without manual review.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.autoApproval}
                    onChange={v => setSettings({ ...settings, autoApproval: v })}
                  />
                </div>
              </div>

              {/* 3. Team Participation & Limits */}
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Team Registrations</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Allow participants to register together as a squad or project team.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.allowTeams}
                    onChange={v => setSettings({ ...settings, allowTeams: v })}
                  />
                </div>

                {settings.allowTeams && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Min Team Members
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.minTeamSize}
                        onChange={e =>
                          setSettings({
                            ...settings,
                            minTeamSize: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#6366F1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Max Team Members
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.maxTeamSize}
                        onChange={e =>
                          setSettings({
                            ...settings,
                            maxTeamSize: parseInt(e.target.value) || 4,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#6366F1]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. College Eligibility Criteria */}
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Eligible Colleges</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Restrict registrations to specific campuses or keep it open inter-collegiate.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, eligibilityScope: 'all' })}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      settings.eligibilityScope === 'all'
                        ? 'border-[#6366F1] bg-[#6366F1]/5 ring-1 ring-[#6366F1]'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#0F172A]">
                        Open to All Colleges
                      </span>
                      {settings.eligibilityScope === 'all' && (
                        <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Students from any verified institution across India can register.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSettings({ ...settings, eligibilityScope: 'restricted' })
                    }
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      settings.eligibilityScope === 'restricted'
                        ? 'border-[#6366F1] bg-[#6366F1]/5 ring-1 ring-[#6366F1]'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#0F172A]">
                        Presidency University Only
                      </span>
                      {settings.eligibilityScope === 'restricted' && (
                        <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Restricted exclusively to enrolled Presidency University students.
                    </p>
                  </button>
                </div>
              </div>

              {/* 5. Year & Branch Filters */}
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Eligible Batches & Years
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(yr => {
                    const isSelected = settings.allowedYears.includes(yr);
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? settings.allowedYears.filter(y => y !== yr)
                            : [...settings.allowedYears, yr];
                          setSettings({ ...settings, allowedYears: updated });
                        }}
                        className={cn(
                          'px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                          isSelected
                            ? 'bg-[#6366F1] text-white border-[#6366F1]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Waitlist & Email Confirmation */}
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Waitlist on Full Capacity
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enable queue if registrations hit {eventData.capacity} participants.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.enableWaitlist}
                    onChange={v => setSettings({ ...settings, enableWaitlist: v })}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Send Automated Email Tickets
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Dispatches registration confirmation with scannable entry QR codes.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.sendEmailConfirmation}
                    onChange={v =>
                      setSettings({ ...settings, sendEmailConfirmation: v })
                    }
                  />
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="flex items-center justify-between border-t border-gray-100 mt-8 pt-6">
                <Button
                  variant="ghost"
                  icon={<ChevronLeft className="w-4 h-4" />}
                  onClick={handlePrevStep}
                >
                  Back to Form Builder
                </Button>
                <Button
                  variant="primary"
                  iconRight={<ChevronRight className="w-4 h-4" />}
                  onClick={handleNextStep}
                >
                  Continue to Review & Publish
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: REVIEW & PUBLISH */}
        {/* ============================================================ */}
        {currentStep === 4 && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
            {/* Ready to Publish Banner */}
            <div className="bg-gradient-to-r from-[#6366F1]/10 via-[#3B82F6]/10 to-[#10B981]/10 border border-[#6366F1]/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#10B981] flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3
                    className="text-lg font-bold text-[#0F172A]"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Ready to Launch!
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    All 4 steps configured. Review the summary below before publishing to the campus feed.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="md"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => setPublishModalOpen(true)}
              >
                Publish Event Now
              </Button>
            </div>

            {/* Summary Card 1: Event Details */}
            <Card padding="md" className="border-gray-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6366F1] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A]">Event Details</h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => setCurrentStep(1)}
                >
                  Edit Details
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 font-medium">Title:</span>
                  <p className="text-sm font-bold text-[#0F172A] mt-0.5">{eventData.title}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Club & Category:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {eventData.club} • {eventData.category}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Schedule:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {eventData.date} from {eventData.startTime} to {eventData.endTime}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Venue & Capacity:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {eventData.venue} ({eventData.capacity} Max Seats)
                  </p>
                </div>
              </div>
            </Card>

            {/* Summary Card 2: Registration Form Fields */}
            <Card padding="md" className="border-gray-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#10B981] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A]">
                    Registration Form Questions ({fields.length} Fields)
                  </h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => setCurrentStep(2)}
                >
                  Edit Form
                </Button>
              </div>

              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-[#0F172A]">{f.label}</span>
                      <span className="text-[10px] uppercase font-bold text-gray-400 px-1.5 py-0.5 rounded bg-white border border-gray-200">
                        {getFieldTypeBadgeLabel(f.type)}
                      </span>
                    </div>
                    <Badge variant={f.required ? 'violet' : 'gray'} className="text-[10px]">
                      {f.required ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Summary Card 3: Settings & Eligibility */}
            <Card padding="md" className="border-gray-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#3B82F6] flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A]">Settings & Policies</h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => setCurrentStep(3)}
                >
                  Edit Settings
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 font-medium">Approval Mode:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {settings.autoApproval ? 'Instant Auto-Approval' : 'Manual Review by Organiser'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Team Participation:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {settings.allowTeams
                      ? `Allowed (${settings.minTeamSize}-${settings.maxTeamSize} Members)`
                      : 'Individual Only'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">College Eligibility:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {settings.eligibilityScope === 'all'
                      ? 'Open to All Campuses'
                      : 'Presidency University Only'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Registration Deadline:</span>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {settings.hasDeadline
                      ? `${settings.deadlineDate} at ${settings.deadlineTime}`
                      : 'Open until event start'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                icon={<ChevronLeft className="w-4 h-4" />}
                onClick={handlePrevStep}
              >
                Back to Settings
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  icon={<Bookmark className="w-4 h-4" />}
                  onClick={handleSaveDraft}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Sparkles className="w-5 h-5 text-white" />}
                  onClick={() => setPublishModalOpen(true)}
                >
                  Confirm & Publish Event
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* PUBLISH CONFIRMATION MODAL */}
      {/* ============================================================ */}
      <Modal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Event"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#6366F1] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">
                Publish &quot;{eventData.title}&quot;?
              </h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                This will make the event visible to students on the Klubrio explore feed. Participants can immediately fill out your customized form and register.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Event Date: <strong>{eventData.date}</strong> at <strong>{eventData.venue}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{fields.length} Custom form fields configured</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Capacity set to {eventData.capacity} students</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPublishModalOpen(false)}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isPublishing}
              icon={<Sparkles className="w-4 h-4" />}
              onClick={handleConfirmPublish}
            >
              Yes, Publish Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* FULLSCREEN PREVIEW MODAL */}
      {/* ============================================================ */}
      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Student Registration View Preview"
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[#10B981] text-xs font-bold uppercase">
                {eventData.club}
              </span>
              <span className="text-xs text-gray-300">• Presidency University</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">{eventData.title}</h2>
            <div className="flex flex-wrap gap-4 text-xs text-gray-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#10B981]" />
                {eventData.date} • {eventData.startTime} - {eventData.endTime}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#6366F1]" />
                {eventData.venue}
              </span>
            </div>
          </div>

          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Registration Form ({fields.length} questions)
            </p>
            {fields.map(field => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {renderPreviewFieldInput(field, previewAnswers, setPreviewAnswers, false)}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setPreviewModalOpen(false)}>
              Close Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => {
                setPreviewModalOpen(false);
                setPublishModalOpen(true);
              }}
            >
              Proceed to Publish
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* PUBLISHED SUCCESS BANNER / TOAST TRIGGER */}
      {/* ============================================================ */}
      {isPublished && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white rounded-2xl shadow-2xl border-2 border-emerald-500 p-5 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-[#0F172A]">Event is Now Live!</h4>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                &quot;{eventData.title}&quot; has been published successfully. Registrations are open.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/events')}
                >
                  View Public Event
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPublished(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELPER: RENDER PREVIEW FIELD INPUTS
// ============================================================
function renderPreviewFieldInput(
  field: FormField,
  answers: Record<string, any>,
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  isCompact: boolean = false
) {
  const value = answers[field.id] || '';
  const updateValue = (v: any) => {
    setAnswers(prev => ({ ...prev, [field.id]: v }));
  };

  const inputSize = isCompact ? 'py-1.5 px-3 text-[11px]' : 'py-2 px-3 text-xs';

  switch (field.type) {
    case 'short_answer':
      return (
        <input
          type="text"
          value={value}
          onChange={e => updateValue(e.target.value)}
          placeholder={field.placeholder || 'Enter short answer...'}
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all',
            inputSize
          )}
        />
      );

    case 'long_answer':
      return (
        <textarea
          rows={isCompact ? 2 : 3}
          value={value}
          onChange={e => updateValue(e.target.value)}
          placeholder={field.placeholder || 'Write your response here...'}
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all leading-relaxed',
            inputSize
          )}
        />
      );

    case 'email':
      return (
        <div className="relative">
          <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            value={value}
            onChange={e => updateValue(e.target.value)}
            placeholder={field.placeholder || 'name@university.in'}
            className={cn(
              'w-full pl-8 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all',
              inputSize
            )}
          />
        </div>
      );

    case 'phone':
      return (
        <div className="flex">
          <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 border-gray-200 bg-gray-100 text-gray-600 text-xs font-semibold">
            +91
          </span>
          <input
            type="tel"
            value={value}
            onChange={e => updateValue(e.target.value)}
            placeholder={field.placeholder || '98765 43210'}
            className={cn(
              'w-full rounded-r-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all',
              inputSize
            )}
          />
        </div>
      );

    case 'dropdown':
      return (
        <div className="relative">
          <select
            value={value}
            onChange={e => updateValue(e.target.value)}
            className={cn(
              'w-full rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all appearance-none pr-8 cursor-pointer',
              inputSize
            )}
          >
            <option value="">Select an option...</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="space-y-1.5 pt-0.5">
          {field.options?.map((opt, idx) => {
            const isChecked = value === opt;
            return (
              <label
                key={idx}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all',
                  isChecked
                    ? 'border-[#6366F1] bg-[#6366F1]/5 text-[#0F172A]'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                )}
              >
                <input
                  type="radio"
                  name={field.id}
                  checked={isChecked}
                  onChange={() => updateValue(opt)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all',
                    isChecked ? 'border-[#6366F1] bg-[#6366F1]' : 'border-gray-300'
                  )}
                >
                  {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs font-medium">{opt}</span>
              </label>
            );
          })}
        </div>
      );

    case 'checkbox':
      const selectedChecks = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5 pt-0.5">
          {field.options?.map((opt, idx) => {
            const isChecked = selectedChecks.includes(opt);
            return (
              <label
                key={idx}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all',
                  isChecked
                    ? 'border-[#6366F1] bg-[#6366F1]/5 text-[#0F172A]'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? selectedChecks.filter((item: string) => item !== opt)
                      : [...selectedChecks, opt];
                    updateValue(next);
                  }}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all',
                    isChecked ? 'border-[#6366F1] bg-[#6366F1] text-white' : 'border-gray-300'
                  )}
                >
                  {isChecked && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className="text-xs font-medium">{opt}</span>
              </label>
            );
          })}
        </div>
      );

    case 'date':
      return (
        <div className="relative">
          <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={value}
            onChange={e => updateValue(e.target.value)}
            className={cn(
              'w-full pl-8 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all',
              inputSize
            )}
          />
        </div>
      );

    case 'file_upload':
      return (
        <div className="border-2 border-dashed border-gray-200 hover:border-[#6366F1] rounded-xl p-3 text-center bg-gray-50/50 transition-colors cursor-pointer group">
          <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-[#6366F1] mx-auto mb-1 transition-colors" />
          <p className="text-[11px] font-semibold text-gray-700 group-hover:text-[#6366F1]">
            Click or drag file to upload
          </p>
          <p className="text-[10px] text-gray-400">PDF, PNG, JPG up to 10MB</p>
        </div>
      );

    case 'team_registration':
      return (
        <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">
              Team / Project Name
            </label>
            <input
              type="text"
              placeholder="e.g. AgriBots Alpha"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-[#6366F1]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">
              Team Member Emails (comma separated)
            </label>
            <input
              type="text"
              placeholder="teammate1@college.edu, teammate2@college.edu"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-[#6366F1]"
            />
          </div>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={value}
          onChange={e => updateValue(e.target.value)}
          placeholder="Enter response..."
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#6366F1] transition-all',
            inputSize
          )}
        />
      );
  }
}
