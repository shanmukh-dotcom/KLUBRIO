'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  ClipboardList,
  Users,
  QrCode,
  Award,
  Mail,
  ImagePlus,
  ShieldCheck,
  Building2,
  UserPlus,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  LogOut,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { KlubrioLogo, KlubrioIcon } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/index';
import { ClubEmblem } from '@/components/ui/club-emblem';
import { useAuth } from '@/lib/auth-context';
import { MOCK_CLUBS } from '@/mocks/data';
import { cn } from '@/lib/utils';

// Switchable Club Workspaces for Organisers
const ORGANISER_CLUBS = [
  {
    id: 'club-1',
    name: 'HARVEST',
    tagline: 'AgriTech Innovation Club',
    college: 'Presidency Univ',
    dot: 'bg-emerald-500',
  },
  {
    id: 'club-2',
    name: 'TechSphere',
    tagline: 'Computing & Tech Society',
    college: 'Presidency Univ',
    dot: 'bg-blue-500',
  },
  {
    id: 'club-3',
    name: 'Design Nexus',
    tagline: 'Creative Design & UX',
    college: 'Presidency Univ',
    dot: 'bg-purple-500',
  },
];

// Main Navigation Items (all matched to exact routes)
const NAV_ITEMS = [
  { href: '/organiser/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/organiser/events', icon: Calendar, label: 'Events' },
  { href: '/organiser/registrations', icon: ClipboardList, label: 'Registrations', badge: '580' },
  { href: '/organiser/participants', icon: Users, label: 'Participants' },
  { href: '/organiser/attendance', icon: QrCode, label: 'QR & Attendance' },
  { href: '/organiser/certificates', icon: Award, label: 'Certificates' },
  { href: '/organiser/emails', icon: Mail, label: 'Emails & Notifications' },
  { href: '/organiser/poster-qr', icon: ImagePlus, label: 'Poster QR' },
  { href: '/organiser/verification', icon: ShieldCheck, label: 'Verification' },
];

// Bottom Management Navigation Items
const BOTTOM_NAV_ITEMS = [
  { href: '/organiser/club-profile', icon: Building2, label: 'Club Profile' },
  { href: '/organiser/members', icon: UserPlus, label: 'Members', badge: '2.5K' },
  { href: '/organiser/settings', icon: Settings, label: 'Settings' },
];

export default function OrganiserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Collapsible state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Club Workspace Switcher state
  const [selectedClub, setSelectedClub] = useState(ORGANISER_CLUBS[0]);
  const [showClubMenu, setShowClubMenu] = useState(false);
  const clubMenuRef = useRef<HTMLDivElement>(null);

  // Header state
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (clubMenuRef.current && !clubMenuRef.current.contains(event.target as Node)) {
        setShowClubMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/organiser/events?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const organiserNotifications = [
    {
      id: 'onotif-1',
      title: 'New Event Registration',
      message: 'Rhea Sharma registered for Nexovate 2.0',
      time: '5 mins ago',
      unread: true,
    },
    {
      id: 'onotif-2',
      title: 'Certificate Batch Ready',
      message: '340 certificates generated for Nexovate 2.0',
      time: '1 hour ago',
      unread: true,
    },
    {
      id: 'onotif-3',
      title: 'Email Campaign Delivered',
      message: 'Event Reminder delivered to 112 participants',
      time: '3 hours ago',
      unread: false,
    },
  ];

  // Sidebar reusable component
  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Top Section: Klubrio Logo */}
      <div className={cn(
        'py-4 border-b border-indigo-100 flex items-center transition-all duration-300',
        collapsed ? 'justify-center px-2' : 'justify-between px-5'
      )}>
        {collapsed ? (
          <Link href="/organiser/dashboard" className="hover:scale-105 transition-transform" title="Klubrio Dashboard">
            <KlubrioIcon size={32} />
          </Link>
        ) : (
          <KlubrioLogo size="sm" href="/organiser/dashboard" />
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-xl text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Club Identity & Workspace Switcher */}
      <div className="px-3 pt-3 pb-2 relative" ref={clubMenuRef}>
        <button
          onClick={() => setShowClubMenu((prev) => !prev)}
          className={cn(
            'w-full text-left bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl transition-all cursor-pointer group',
            collapsed ? 'p-2 flex justify-center' : 'p-2.5'
          )}
          title="Switch Club Workspace"
          aria-expanded={showClubMenu}
        >
          <div className="flex items-center gap-2.5">
            <ClubEmblem name={selectedClub.name} size="md" className="shrink-0" />

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {selectedClub.name}
                    </span>
                    <span
                      className={cn('w-2 h-2 rounded-full shrink-0', selectedClub.dot)}
                      title="Active Club"
                    />
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 font-normal truncate leading-tight mt-0.5">
                  {selectedClub.tagline}
                </p>
              </div>
            )}
          </div>
        </button>

        {/* Club Switcher Floating Dropdown */}
        {showClubMenu && (
          <div
            className={cn(
              'absolute top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150',
              collapsed ? 'left-14 w-60' : 'left-3 right-3'
            )}
          >
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                My Club Workspaces
              </span>
              <span className="text-[11px] font-medium text-[#4F46E5]">3 Available</span>
            </div>
            <div className="p-1.5 space-y-1">
              {ORGANISER_CLUBS.map((c) => {
                const isCurrent = c.id === selectedClub.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClub(c);
                      setShowClubMenu(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer',
                      isCurrent
                        ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <ClubEmblem name={c.name} size="sm" className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{c.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{c.tagline}</div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-[#4F46E5] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Switch to Student Portal Banner */}
      <div className="px-3 pb-2">
        <Link
          href="/student/home"
          className={cn(
            'flex items-center gap-2 rounded-xl transition-all duration-200 border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700 group',
            collapsed
              ? 'p-2.5 justify-center'
              : 'px-3 py-2'
          )}
          title="Switch to Student Feed & Discovery"
        >
          <Sparkles className="w-4 h-4 text-[#4F46E5] shrink-0" />
          {!collapsed && (
            <div className="flex-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">Student Portal</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.5 rounded-full">Switch</span>
            </div>
          )}
        </Link>
      </div>

      {/* Section Label */}
      {!collapsed && (
        <div className="px-4 pt-2 pb-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Event Management
          </p>
        </div>
      )}

      {/* Main Nav Items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
          const isActive =
            pathname === href ||
            (href !== '/organiser/dashboard' && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 py-2.5 rounded-xl transition-all duration-150',
                collapsed ? 'justify-center px-2' : 'px-3 text-xs md:text-sm',
                isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 font-medium'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-[#4F46E5]' : 'text-[#64748B] group-hover:text-[#0F172A]'
                )}
              />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && badge && (
                <span
                  className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    isActive
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Club Admin Divider */}
        {!collapsed && (
          <div className="pt-3 pb-1 px-2.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Club Admin
            </p>
          </div>
        )}

        {BOTTOM_NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 py-2.5 rounded-xl transition-all duration-150',
                collapsed ? 'justify-center px-2' : 'px-3 text-xs md:text-sm',
                isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 font-medium'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-[#4F46E5]' : 'text-[#64748B] group-hover:text-[#0F172A]'
                )}
              />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && badge && (
                <span
                  className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    isActive
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick Create Event Shortcut */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-100">
          <Link
            href="/organiser/events/new"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] text-white rounded-xl text-xs font-semibold shadow-xs hover:opacity-95 transition-all cursor-pointer"
          >
            <span>+ Create Event</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] overflow-hidden antialiased">
      {/* Desktop Collapsible Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col shrink-0 bg-white border-r border-indigo-100 shadow-sm h-full transition-all duration-300 z-20',
        isCollapsed ? 'w-[76px]' : 'w-[240px]'
      )}>
        <SidebarContent collapsed={isCollapsed} />
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-white shadow-2xl z-50 flex flex-col">
            <SidebarContent collapsed={false} />
          </aside>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with Hamburger */}
        <header className="shrink-0 bg-white border-b border-slate-200/80 px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3 z-10">
          {/* Left: Hamburger & Search */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* Hamburger Button for BOTH Desktop and Mobile */}
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileOpen(prev => !prev);
                } else {
                  setIsCollapsed(prev => !prev);
                }
              }}
              className="p-2 rounded-xl text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
              title="Toggle collapsible sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, registrations, participants..."
                className="w-full pl-9 pr-12 py-2 bg-[#F1F5F9] text-xs md:text-sm text-[#0F172A] placeholder-[#94A3B8] border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] transition-all"
              />
              <div className="hidden sm:flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                <span>/</span>
              </div>
            </form>
          </div>

          {/* Right: Actions, Notification, User Dropdown */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Direct Switch to Student Portal */}
            <Link
              href="/student/home"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>Student View</span>
            </Link>

            {/* Dynamic Club Tag badge */}
            <div className="hidden md:flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{selectedClub.name}</span>
            </div>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications((prev) => !prev);
                  setShowUserMenu(false);
                }}
                className={cn(
                  'relative p-2 rounded-xl text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer',
                  showNotifications && 'bg-slate-100 text-[#0F172A]'
                )}
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white leading-none">
                  3
                </span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                    <span className="text-xs font-black text-[#0F172A] uppercase tracking-wider">
                      Organiser Alerts
                    </span>
                    <span className="text-[11px] font-bold text-[#6366F1] cursor-pointer hover:underline">
                      Mark all read
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {organiserNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'p-3 hover:bg-indigo-50/50 transition-colors cursor-pointer',
                          n.unread && 'bg-indigo-50/30'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-[#0F172A]">{n.title}</p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
                            {n.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="p-2 border-t border-slate-100 text-center">
                    <Link
                      href="/organiser/emails"
                      onClick={() => setShowNotifications(false)}
                      className="text-xs font-bold text-[#6366F1] hover:underline inline-block py-1"
                    >
                      View all communications & activity
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => {
                  setShowUserMenu((prev) => !prev);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-indigo-50 transition-colors focus:outline-none cursor-pointer"
                aria-label="User profile menu"
              >
                <Avatar
                  name={user?.fullName || 'Ballaya'}
                  src={user?.avatar}
                  size="sm"
                  className="ring-2 ring-emerald-500/40"
                />
                <div className="hidden sm:block text-left pr-1">
                  <p className="text-xs font-bold text-[#0F172A] leading-tight truncate max-w-[100px]">
                    {user?.fullName || 'Ballaya'}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium leading-tight">
                    Lead Organiser
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-bold text-[#0F172A] truncate">
                      {user?.fullName || 'Ballaya'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{user?.email || 'ballaya@example.com'}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Lead Organiser
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">{selectedClub.name} Club</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/organiser/club-profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Building2 className="w-4 h-4 text-slate-400" />
                      Club Identity & Profile
                    </Link>
                    <Link
                      href="/organiser/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      Workspace Settings
                    </Link>
                    <Link
                      href="/student/home"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Switch to Student View
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Organiser Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
