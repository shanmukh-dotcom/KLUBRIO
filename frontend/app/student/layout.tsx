'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Compass, Calendar, Users, User, Settings, LogOut, Bell, Menu, X, ChevronDown, Building2,
  Sparkles, ShieldCheck, ChevronLeft, ChevronRight, Search
} from 'lucide-react';
import { KlubrioLogo, KlubrioIcon } from '@/components/ui/logo';
import { Avatar, Badge } from '@/components/ui/index';
import { useAuth } from '@/lib/auth-context';
import { MOCK_COLLEGES } from '@/mocks/data';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/student/home', icon: Home, label: 'Home' },
  { href: '/student/discover', icon: Compass, label: 'Explore' },
  { href: '/student/events', icon: Calendar, label: 'Events' },
  { href: '/student/clubs', icon: Users, label: 'Clubs' },
  { href: '/student/profile', icon: User, label: 'Profile' },
];

const BOTTOM_ITEMS = [
  { href: '/student/settings', icon: Settings, label: 'Settings' },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  
  // Sidebar states
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Header dropdown states
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollege, setSelectedCollege] = useState(user?.college ?? 'Presidency University');

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const collegeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (collegeDropdownRef.current && !collegeDropdownRef.current.contains(e.target as Node)) {
        setShowCollegeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/student/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Logo Header */}
      <div className={cn(
        'py-4 border-b border-indigo-100/80 flex items-center transition-all duration-300',
        collapsed ? 'justify-center px-2' : 'justify-between px-5'
      )}>
        {collapsed ? (
          <Link href="/student/home" className="hover:scale-105 transition-transform" title="Klubrio Home">
            <KlubrioIcon size={32} />
          </Link>
        ) : (
          <KlubrioLogo size="sm" href="/student/home" />
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-xl text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Portal Switcher Pill */}
      <div className="px-3 pt-3 pb-2">
        <Link
          href="/organiser/dashboard"
          className={cn(
            'flex items-center gap-2 rounded-xl transition-all duration-150 border group',
            collapsed
              ? 'p-2 justify-center bg-slate-50 border-slate-200/80 hover:bg-slate-100'
              : 'p-2.5 bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/80'
          )}
          title="Switch to Club Organiser Portal"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700">Organiser Hub</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">Switch</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">Manage HARVEST Club</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 py-2.5 rounded-xl transition-colors duration-150',
                collapsed ? 'justify-center px-2' : 'px-3.5 text-sm',
                isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 font-medium'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  'w-4.5 h-4.5 shrink-0 transition-colors',
                  isActive ? 'text-[#4F46E5]' : 'text-[#64748B] group-hover:text-[#0F172A]'
                )}
                strokeWidth={isActive ? 2 : 1.75}
              />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444] text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Go Premium Upgrade Widget (Exact match to Modern Campus Dashboard Interface reference) */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3.5 rounded-2xl bg-[#EEF2FF] border border-indigo-100/70">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base select-none">👑</span>
            <span className="text-xs font-bold text-[#0F172A]">Go Premium</span>
          </div>
          <p className="text-[11px] text-[#64748B] leading-snug mb-3 font-normal">
            Unlock exclusive features!
          </p>
          <button
            onClick={() => router.push('/student/settings')}
            className="w-full py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 py-2 rounded-xl text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 transition-colors',
              collapsed ? 'justify-center px-2' : 'px-3'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4.5 h-4.5 text-[#64748B]" strokeWidth={1.75} />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors w-full cursor-pointer',
            collapsed ? 'justify-center px-2' : 'px-3'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4.5 h-4.5 text-slate-500 hover:text-rose-600" strokeWidth={1.75} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-white z-50 shadow-2xl flex flex-col">
            <SidebarContent collapsed={false} />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with Hamburger & Cross-navigation */}
        <header className="shrink-0 bg-white/95 backdrop-blur-sm border-b border-indigo-100/90 px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3 z-10 shadow-xs">
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
              className="p-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-[#4F46E5] transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xs"
              aria-label="Toggle navigation menu"
              title="Toggle collapsible sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Search */}
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="w-4 h-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clubs, events, workshops..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-xs md:text-sm text-[#0F172A] placeholder-slate-400 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all shadow-2xs"
              />
            </form>
          </div>

          {/* Right actions: Switcher, Notifications, Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Switch to Organiser Mode */}
            <Link
              href="/organiser/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-800 border border-emerald-300 hover:bg-emerald-500 hover:text-white transition-all shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Organiser Portal</span>
            </Link>

            {/* College selector dropdown */}
            <div className="relative" ref={collegeDropdownRef}>
              <button
                onClick={() => setShowCollegeDropdown(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/60 border border-indigo-200/80 rounded-full text-xs md:text-sm font-bold text-[#0F172A] hover:bg-indigo-100/60 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
              >
                <Building2 className="w-4 h-4 text-[#6366F1]" />
                <span className="max-w-[120px] sm:max-w-[160px] truncate">{selectedCollege}</span>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
              </button>
              {showCollegeDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-1">
                  <p className="px-4 py-2 text-[10px] font-black text-indigo-500 uppercase tracking-wider">Select Campus</p>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {MOCK_COLLEGES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCollege(c.name); setShowCollegeDropdown(false); }}
                        className={cn(
                          'w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 transition-colors flex items-center justify-between',
                          selectedCollege === c.name ? 'text-[#6366F1] font-black bg-indigo-50/70' : 'text-slate-700 font-semibold'
                        )}
                      >
                        <div>
                          <p>{c.name}</p>
                          <p className="text-[10px] text-slate-400">{c.city}, {c.state}</p>
                        </div>
                        {selectedCollege === c.name && <span className="text-emerald-500 font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Bell */}
            <Link
              href="/student/notifications"
              className="relative p-2 rounded-full text-slate-600 hover:text-[#4F46E5] hover:bg-indigo-50 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
            </Link>

            {/* User Avatar Menu */}
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setShowUserDropdown(v => !v)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer"
              >
                <Avatar name={user?.fullName ?? 'Ballaya'} src={user?.avatar} size="sm" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-black text-[#0F172A] truncate">{user?.fullName ?? 'Ballaya'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email ?? 'ballaya@example.com'}</p>
                    <span className="mt-1 inline-block text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full">
                      Student
                    </span>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/student/profile"
                      onClick={() => setShowUserDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      View Profile
                    </Link>
                    <Link
                      href="/student/settings"
                      onClick={() => setShowUserDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      Account Settings
                    </Link>
                    <Link
                      href="/organiser/dashboard"
                      onClick={() => setShowUserDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      Switch to Organiser
                    </Link>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
