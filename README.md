# Klubrio — Campus Life, Upgraded

Klubrio is a modern, production-grade web application connecting campus clubs, student communities, event organizers, and participants.

---

## 🚀 Quick Start

To run the application locally:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To verify a production build:

```bash
cd frontend
npm run build
npm run start
```

---

## 📁 Project Architecture

```text
KLUBRIO/
├── frontend-mockups/          # Visual reference specifications and mockups
│   ├── 44395.png              # Reference 01: Brand Identity Board
│   ├── Campus Life Upgraded Landing Page(1).png
│   ├── Klubrio Campus Signup Experience(1).png
│   ├── Klubrio Campus Login Split Screen(1).png
│   ├── Klubrio Campus Journey Profile Onboarding(1).png
│   ├── Klubrio Campus Welcome Screen(1)(1).png
│   ├── Modern Campus Dashboard Interface (1).png
│   ├── Klubrio Notifications Dashboard(1).png
│   ├── Klubrio Event Registration Builder Dashboard(1).png
│   ├── Klubrio QR Attendance Dashboard(1).png
│   ├── Klubrio Email Campaign Dashboard(1)(1).png
│   └── Klubrio Certificate Verification Dashboard(2).png
│
├── frontend/                  # All frontend application source code
│   ├── app/                   # Next.js App Router routes
│   │   ├── (public)/          # Landing, login, signup, onboarding, welcome
│   │   │   ├── page.tsx       # / — Public Homepage
│   │   │   ├── login/         # /login — Split-screen authentication
│   │   │   ├── signup/        # /signup — Searchable institution onboarding
│   │   │   ├── onboarding/    # /onboarding/profile — Multi-step profile setup
│   │   │   ├── welcome/       # /welcome — Onboarding completion
│   │   │   ├── events/        # /events — Public event exploration
│   │   │   ├── clubs/         # /clubs — Public club directory
│   │   │   └── forgot-password/ # /forgot-password
│   │   │
│   │   ├── student/           # Authenticated Student Interface
│   │   │   ├── layout.tsx     # Student shell (sidebar, college switcher, bell)
│   │   │   ├── home/          # /student/home — Dashboard with hero banner & feed
│   │   │   ├── discover/      # /student/discover — Explore trending events & clubs
│   │   │   ├── events/        # /student/events — My registered & upcoming events
│   │   │   ├── clubs/         # /student/clubs — Club membership & directory
│   │   │   ├── people/        # /student/people — Campus peer networking
│   │   │   ├── messages/      # /student/messages — Real-time direct chat interface
│   │   │   ├── notifications/ # /student/notifications — Tabbed notification center
│   │   │   ├── profile/       # /student/profile — Student portfolio & certificates
│   │   │   └── settings/      # /student/settings — Preferences & privacy
│   │   │
│   │   └── organiser/         # Authenticated Club Organiser Interface
│   │       ├── layout.tsx     # Organiser shell (HARVEST branding, navigation)
│   │       ├── dashboard/     # /organiser/dashboard — Metrics & quick actions
│   │       ├── events/        # /organiser/events — Event management
│   │       │   └── new/       # /organiser/events/new — 4-Step Event & Form Builder
│   │       ├── registrations/ # /organiser/registrations — Registrations table & CSV
│   │       ├── participants/  # /organiser/participants — Participant registry
│   │       ├── attendance/    # /organiser/attendance — QR check-in & poster QR
│   │       ├── certificates/  # /organiser/certificates — Visual cert designer & bulk issue
│   │       ├── emails/        # /organiser/emails — 3-Column email campaign studio
│   │       ├── poster-qr/     # /organiser/poster-qr — Add QR overlay to posters
│   │       ├── verification/  # /organiser/verification — Tamper-proof cert verification
│   │       ├── club-profile/  # /organiser/club-profile — Club branding & socials
│   │       ├── members/       # /organiser/members — Team roles & invites
│   │       └── settings/      # /organiser/settings — Club workspace configurations
│   │
│   ├── components/            # Design system components
│   │   ├── ui/                # Button, Input, Card, Badge, Avatar, Modal, etc.
│   │   └── layouts/           # Split-screen auth layout, navbars
│   ├── lib/                   # AuthContext, ToastContext, formatting utils
│   ├── mocks/                 # Typed mock data (clubs, events, participants, etc.)
│   └── types/                 # TypeScript interfaces
└── README.md
```

---

## 🎨 Design System & Implementation Details

- **Typography**: `Poppins` for bold headlines and identity, `Inter` for clean body text.
- **Brand Colors**:
  - Primary Violet: `#6366F1`
  - Accent Blue: `#3B82F6`
  - Emerald Teal: `#10B981`
  - Dark Navy: `#0F172A`
- **Component Quality**:
  - Full TypeScript type safety throughout.
  - Zero mock placeholders — rich interactive state across forms, search, filters, modals, and tabs.
  - Responsive layout down to mobile viewports with collapsible sidebars and touch drawers.
  - Real-time previews: Form builder live device frame, poster QR coordinate positioning, certificate template rendering, and email WYSIWYG previewer.
