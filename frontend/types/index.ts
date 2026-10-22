// ============================================================
// TYPES — All TypeScript interfaces for Klubrio
// ============================================================

// ---- User & Auth ----
export interface User {
  id: string;
  fullName: string;
  email: string;
  avatar?: string;
  college?: string;
  collegeId?: string;
  branch?: string;
  yearOfStudy?: number;
  interests?: string[];
  role: 'student' | 'organiser' | 'admin';
  createdAt: string;
}

// ---- Club ----
export interface Club {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logo?: string;
  coverImage?: string;
  category: string;
  membersCount: number;
  eventsCount: number;
  college: string;
  collegeId: string;
  isFollowing?: boolean;
  isMember?: boolean;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
}

// ---- Event ----
export interface Event {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  date: string; // ISO string
  startTime: string;
  endTime?: string;
  venue: string;
  clubId: string;
  clubName: string;
  clubLogo?: string;
  college: string;
  collegeId: string;
  category: string;
  tags?: string[];
  registeredCount: number;
  capacity?: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  isRegistered?: boolean;
  registrationDeadline?: string;
  teamBased?: boolean;
}

// ---- Registration ----
export interface Registration {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  registrationId: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked-in';
  checkedIn: boolean;
  checkedInAt?: string;
  submittedAt: string;
  formData: Record<string, string | string[]>;
  qrCode?: string;
  teamName?: string;
  teamMembers?: string[];
}

// ---- Notification ----
export type NotificationType = 'event' | 'club' | 'message' | 'opportunity' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  summary: string;
  timestamp: string;
  read: boolean;
  link?: string;
  icon?: string;
}

// ---- Form Builder ----
export type FieldType =
  | 'short_answer'
  | 'long_answer'
  | 'email'
  | 'phone'
  | 'dropdown'
  | 'multiple_choice'
  | 'checkbox'
  | 'date'
  | 'file_upload'
  | 'team_registration';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// ---- Attendance ----
export interface Participant {
  id: string;
  name: string;
  email: string;
  registrationId: string;
  avatar?: string;
  status: 'checked-in' | 'not-checked-in';
  checkedInAt?: string;
}

// ---- Email Campaign ----
export type EmailTemplate =
  | 'registration_confirmation'
  | 'event_reminder'
  | 'event_update'
  | 'certificate_delivery'
  | 'post_event_followup'
  | 'custom';

export interface EmailCampaign {
  id: string;
  eventId: string;
  subject: string;
  template: EmailTemplate;
  recipientCount: number;
  sentAt: string;
  status: 'sent' | 'scheduled' | 'draft' | 'failed';
  delivered?: number;
  opened?: number;
  clicked?: number;
}

// ---- Certificate ----
export interface Certificate {
  id: string;
  certificateId: string;
  participantId: string;
  participantName: string;
  eventId: string;
  eventName: string;
  clubName: string;
  issueDate: string;
  type: 'participation' | 'achievement' | 'volunteer' | 'organiser';
  status: 'valid' | 'revoked';
  verificationUrl?: string;
}

// ---- College ----
export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
}
