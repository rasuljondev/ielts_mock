# IELTS Mock Platform - Complete Educational Solution

<div align="center">

![IELTS Platform](https://img.shields.io/badge/IELTS-Platform-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)
![Supabase](https://img.shields.io/badge/Supabase-2.50.3-green.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.11-blue.svg)

A production-ready IELTS testing platform with authentic exam formatting, real-time grading, and comprehensive test creation tools.

**Built by [rasuljondev](https://github.com/rasuljondev)**

</div>

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [💻 Development](#-development)
- [🔧 Configuration](#-configuration)
- [📖 Usage Guide](#-usage-guide)
- [🔒 Security](#-security)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🤝 Contributing](#-contributing)

## 🎯 Overview

The IELTS Mock Platform is a comprehensive web application designed for educational institutions to create, manage, and administer authentic IELTS tests. The platform features real IELTS exam formatting, advanced media management, and multi-format submission capabilities.

### 🌟 What Makes This Platform Special

- **🎯 Authentic IELTS Format**: Real exam-style interfaces matching official IELTS papers
- **🎵 Advanced Media Management**: Upload, manage, and display images, audio, and video content
- **📝 Multi-Format Submissions**: Students can submit text, audio recordings, files, and images
- **⚡ Real-Time Grading**: Instant feedback with criteria-based assessment
- **🔒 Enterprise Security**: Row-level security with role-based access control
- **📱 Mobile Responsive**: Works seamlessly across all devices
- **🌐 Multi-Tenant**: Support for multiple educational centers

## ✨ Key Features

### 👥 Role-Based System

#### 🏢 Super Admin

- Manage multiple educational centers
- Platform-wide statistics and analytics
- User management across all centers
- System configuration and monitoring

#### 🎓 Educational Admin

- Create and manage tests for their center
- Upload media content (images, audio, video)
- Grade student submissions with advanced tools
- Monitor student progress and performance

#### 👨‍🎓 Students

- Take tests with multimedia content and authentic IELTS formatting
- Submit answers in multiple formats (text, audio, files)
- View real-time feedback and scores
- Track progress and test history

### 🎮 Test Creation System

#### 🎵 Listening Tests

- **Advanced Audio Player**: Professional controls with seek, volume, replay
- **Interactive Questions**: Drag-and-drop matching, sentence completion, short answers
- **Authentic IELTS Format**: Clean input fields with real exam styling (box inputs with shadows)
- **Multiple Formats**: Support for various audio formats (MP3, WAV, M4A)
- **Smart Content Parsing**: Extracts actual item labels from content instead of showing \"Question X:\"

#### 📖 Reading Tests

- **Passage Management**: Rich text passages with embedded media
- **Question Types**: Multiple choice, True/False/Not Given, matching, fill-in-blanks
- **Visual Aids**: Support for charts, diagrams, and reference images
- **Flexible Timing**: Configurable duration per passage

#### ��� Writing Tests

- **Rich Text Editor**: TipTap-based editor with formatting tools
- **Reference Materials**: Upload charts, graphs, and images
- **Task Configuration**: Set word limits, duration, and instructions
- **Multi-Task Support**: Academic Task 1 & 2, General Training

### 📊 Grading System

#### 🎯 Criteria-Based Assessment

- **IELTS Standard Rubrics**: Pre-configured rubrics for all test types
- **Custom Criteria**: Create institution-specific assessment criteria
- **Weighted Scoring**: Flexible point allocation across criteria
- **Detailed Feedback**: Rich text feedback with specific improvements
- **Manual Grading**: Comprehensive manual grading tools for educators

#### 🎯 Enhanced Review Tools

- **Side-by-Side Comparison**: Traditional vs enhanced review interfaces
- **Audio Playback**: Full controls for reviewing audio submissions
- **Image Analysis**: Fullscreen viewing for visual submissions
- **Progress Tracking**: Real-time score calculation

### 💾 Media Management

#### 📤 Upload System

- **Drag & Drop**: Intuitive file upload with visual feedback
- **Multi-Format Support**: Images (JPG, PNG, GIF, WebP), Audio (MP3, WAV, M4A)
- **Real-Time Progress**: Visual upload progress with error handling
- **File Validation**: Automatic type and size validation
- **Cloud Storage**: Supabase integration with local fallback

#### 🎬 Display System

- **Professional Audio Player**: Seek, volume, playback speed controls
- **Image Viewer**: Zoom, fullscreen, download capabilities
- **Responsive Layout**: Grid and list view options
- **Accessibility**: Screen reader support and keyboard navigation

## 🏗️ Architecture

### 🌐 Tech Stack

#### Frontend

- **React 18.3.1**: Modern functional components with hooks
- **TypeScript 5.5.3**: Full type safety across the application
- **Vite 6.3.5**: Lightning-fast development and build tools
- **TailwindCSS 3.4.11**: Utility-first CSS framework
- **Framer Motion 12.23.0**: Smooth animations and transitions

#### Backend

- **Express 4.18.2**: RESTful API server integrated with Vite
- **Supabase 2.50.3**: PostgreSQL database with real-time capabilities
- **Node.js**: Server-side JavaScript runtime

#### UI Components

- **Radix UI**: Accessible, unstyled component primitives
- **TipTap 3.0.7**: Rich text editor for content creation
- **React Hook Form 7.53.0**: Performant form management
- **Zod 3.23.8**: Schema validation for type safety

#### Media Processing

- **HTML5 Audio/Video**: Native browser media handling
- **React H5 Audio Player**: Professional audio controls
- **Canvas API**: Image manipulation and processing
- **File API**: Advanced file upload and processing

### 🏛️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server │    │   Supabase DB   │
│                 │    │                 │    │                 │
│  • Components   │◄──►│  • API Routes   │◄──►│  • PostgreSQL   │
│  • State Mgmt   │    │  • Auth Middleware │  │  • Row Level    │
│  • Routing      │    │  • File Handling│    │    Security     │
│  • Media Upload │    │  • Validation   │    │  • Real-time    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Storage  │    │   Authentication│    │    Monitoring   │
│                 │    │                 │    │                 │
│  • Supabase     │    │  • JWT Tokens   │    │  • Error        │
│    Storage      │    │  • Role-based   │    │    Tracking     │
│  • CDN Delivery │    │    Access       │    │  • Performance  │
│  • Auto Backup  │    │  • Session Mgmt │    │    Metrics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
ielts-platform/
├── 📁 client/                          # React frontend application
│   ├── 📁 components/                   # Reusable UI components
│   │   ├── 📁 admin/                   # Admin-specific components
│   │   │   ├── StorageSetup.tsx            # Storage configuration
│   │   │   ├── SubmissionReviewModal.tsx   # Traditional review interface
│   │   │   └── WritingGradingModal.tsx     # Writing-specific grading
│   │   ├── 📁 auth/                    # Authentication components
│   │   │   └── ProtectedRoute.tsx          # Route protection wrapper
│   │   ├── 📁 layout/                  # Layout components
│   │   │   └── AppLayout.tsx               # Main application layout
│   │   ├── 📁 test-creation/           # Test creation tools
│   │   │   ├── EnhancedIELTSEditor.tsx     # Advanced test editor
│   │   │   ├── IELTSListeningEditor.tsx    # Listening test editor
│   │   │   ├── UnifiedTestEditor.tsx       # Multi-purpose editor
│   │   │   └── WritingPromptEditor.tsx     # Writing prompt editor
│   │   └── 📁 ui/                      # Core UI components (65+ components)
│   │       ├── media-uploader.tsx          # 📤 File upload system
│   │       ├── media-display.tsx           # 🎵 Media viewer/player
│   │       ├── answer-submission.tsx       # ✍️ Student submission system
│   │       ├── answer-review.tsx           # ⭐ Admin grading interface
│   │       ├── audio-manager.tsx           # Professional audio controls
│   │       └── [60+ other components]      # Complete UI library
│   ├── 📁 contexts/                    # React contexts
│   │   └── AuthContext.tsx                 # Authentication state
│   ├── 📁 docs/                        # Documentation
│   │   ├── FORMATTING_GUIDE.md            # IELTS formatting guidelines
│   │   └── LISTENING_TEST_SYSTEM.md       # Listening test documentation
│   ├── 📁 hooks/                       # Custom React hooks
│   │   ├── use-mobile.tsx                  # Mobile detection
│   │   └── use-toast.ts                    # Toast notifications
│   ├── 📁 lib/                         # Utility libraries
│   │   ├── autoGrading.ts                  # Grading logic
│   │   ├── supabase.ts                     # Database client
│   │   ├── uploadUtils.ts                  # File upload utilities
│   │   ├── contentParser.ts                # Content parsing utilities
│   │   ├── bracketParser.ts                # Question bracket parsing
│   │   ├── errorUtils.ts                   # Error handling
│   │   └── utils.ts                        # General utilities
│   ├── 📁 pages/                       # Application pages
│   │   ├── 📁 auth/                    # Authentication pages
│   │   │   ├── Login.tsx                   # User login
│   │   │   ├── Signup.tsx                  # User registration
│   │   │   ├── ForgotPassword.tsx          # Password recovery
│   │   │   └── ResetPassword.tsx           # Password reset
│   │   ├── 📁 edu-admin/               # Educational admin pages
│   │   │   ├── Dashboard.tsx               # Admin dashboard
│   │   │   ├── CreateTestAdvanced.tsx      # Advanced test creation
│   │   │   ├── CreateIELTSTest.tsx         # IELTS-specific creation
│   │   │   ├── CreateWritingNew.tsx        # ✍️ Writing test creation
│   │   │   ├── CreateListeningNew.tsx      # 🎵 Listening test creation
│   │   │   ├── CreateReadingNew.tsx        # 📖 Reading test creation
│   │   │   ├── ListeningTestCreation.tsx   # Legacy listening creation
│   │   │   ├── TestRequests.tsx            # Test assignment requests
│   │   │   ├── TestSubmissions.tsx         # 📊 Submission management
│   │   │   └── TestGrading.tsx             # Grading interface
│   │   ├── 📁 student/                 # Student pages
│   │   │   ├── Dashboard.tsx               # Student dashboard
│   │   │   ├── AvailableTests.tsx          # Available tests listing
│   │   │   ├── ListeningTestTaking.tsx     # 🎵 Authentic IELTS listening interface
│   │   │   ��── TakeWritingTest.tsx         # ✍️ Writing test interface
│   │   │   ├── TakeReadingExam.tsx         # 📖 Reading test interface
│   │   │   ├── TestHistory.tsx             # Test history and results
│   │   │   └── [7 more student pages]      # Complete student workflow
│   │   ├── 📁 super-admin/             # Super admin pages
│   │   │   ├── Dashboard.tsx               # Platform overview
│   │   │   ├── EduCenters.tsx              # Center management
│   │   │   ├── Users.tsx                   # User management
│   │   │   └── Admins.tsx                  # Admin management
│   │   ├── 📁 profile/                 # User profile
│   │   │   └── ProfilePage.tsx             # Profile management
│   │   ├── Index.tsx                       # Landing page
│   │   ├── NotFound.tsx                    # 404 error page
│   │   └── TestEditorPage.tsx              # Test editor interface
│   ├── 📁 store/                       # State management
│   │   └── authStore.ts                    # Authentication store
│   ├── 📁 types/                       # TypeScript definitions
│   │   └── auth.ts                         # Authentication types
│   ├── App.tsx                             # Main application component
│   └── global.css                          # Global styles
├── 📁 server/                          # Express backend
│   ├── 📁 routes/                      # API routes
│   │   └── demo.ts                         # Example API route
│   ├── index.ts                            # Server configuration
│   └── node-build.ts                       # Production build
├── 📁 shared/                          # Shared code
│   └── api.ts                              # API type definitions
├── 📁 public/                          # Static assets
│   ├── placeholder.svg                     # Placeholder images
│   └── robots.txt                          # SEO configuration
├── 📁 sql/                             # Database scripts
│   └── fix_question_type_constraint.sql    # Database fixes
├── 📄 database_setup.sql               # 🗄️ Complete database schema
├── 📄 fix_listening_questions_schema.sql   # Schema migration
├── 📄 package.json                     # Dependencies and scripts
├── 📄 tailwind.config.ts               # TailwindCSS configuration
├── 📄 tsconfig.json                    # TypeScript configuration
├── 📄 vite.config.ts                   # Vite configuration
└── 📄 README.md                        # This documentation
```

### 🎯 Key Component Highlights

#### 🎵 Listening Test System (`ListeningTestTaking.tsx`)

**THE CROWN JEWEL** - Authentic IELTS listening interface with:

- **Real Exam Formatting**: Clean input fields matching actual IELTS papers
- **Smart Content Parsing**: Extracts item labels like \"Dining table:\" instead of \"Question 1:\"
- **Drag-and-Drop Matching**: Professional matching questions with visual feedback
- **Box-Style Inputs**: Shadow-styled input fields like real exam answer sheets
- **Content-Aware Questions**: Automatically parses HTML content to show contextual labels

#### 📤 Media Management (`media-uploader.tsx` & `media-display.tsx`)

- **Advanced Upload System**: Drag & drop with progress tracking
- **Professional Audio Player**: Full controls with seek, volume, speed
- **Image Viewer**: Zoom, fullscreen, download capabilities
- **Multi-Format Support**: Images, audio, video with validation

#### ✍️ Submission System (`answer-submission.tsx` & `answer-review.tsx`)

- **Multi-Format Answers**: Text, audio recording, file upload
- **Criteria-Based Grading**: Configurable rubrics with weighted scoring
- **Real-Time Feedback**: Instant score calculation and detailed comments
- **Manual Grading**: Comprehensive manual grading tools for educators
- **Audio Review Tools**: Full playback controls for grading audio submissions

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js** 18.0+ (LTS recommended)
- **npm** 9.0+ or **yarn** 1.22+
- **Supabase Account** (for database and storage)
- **Modern Browser** (Chrome, Firefox, Safari, Edge)

### ⚙️ Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-org/ielts-platform.git
cd ielts-platform
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment setup**

```bash
cp .env.example .env.local
```

4. **Configure environment variables**

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Application Configuration
VITE_APP_TITLE=\"IELTS Platform\"
VITE_APP_ENV=development
```

5. **Database setup**

```bash
# Run the comprehensive database setup
psql -h your_host -U your_user -d your_db -f database_setup.sql

# Apply any schema fixes
psql -h your_host -U your_user -d your_db -f fix_listening_questions_schema.sql
```

6. **Start development server**

```bash
npm run dev
# Server will start on http://localhost:8080
```

## 💻 Development

### 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run typecheck        # TypeScript validation
npm test                 # Run test suite with Vitest

# Production
npm run build           # Build for production
npm run build:client    # Build client only
npm run build:server    # Build server only
npm run start           # Start production server

# Maintenance
npm run format.fix      # Auto-format code with Prettier
```

### 🏗️ Development Workflow

#### Creating New Components

1. **UI Components** go in `client/components/ui/`
2. **Page Components** go in `client/pages/[role]/`
3. **Shared Components** go in `client/components/[category]/`

#### Adding New Pages

1. Create page component in appropriate role folder
2. Add route in `client/App.tsx`
3. Add navigation link if needed

#### Database Migrations

For new database changes:

1. Create migration file: `sql/YYYY-MM-DD-description.sql`
2. Test on development database
3. Update `database_setup.sql` for new installations
4. Document changes in this README

## 🔧 Configuration

### Supabase Setup

1. **Create a new Supabase project**
2. **Configure authentication providers**
3. **Run database setup script**: `database_setup.sql`
4. **Configure storage buckets** (handled automatically by setup script)
5. **Update environment variables**

### Storage Buckets

The setup script automatically creates:

- `test-files`: General test content (100MB limit)
- `profile-images`: User avatars (10MB limit)
- `edu-center-logos`: Institution logos (5MB limit)

## 📖 Usage Guide

### 🎓 Educational Admin Workflow

#### Creating Listening Tests

1. **Navigate to Test Creation**

   ```
   Dashboard → Tests → Create New Listening Test
   ```

2. **Upload Audio Content**

   - Use the MediaUploader component
   - Drag & drop audio files
   - Preview uploaded content

3. **Create Questions with Authentic Formatting**

   - Use the UnifiedTestEditor for content creation
   - Questions automatically parse to show real item labels (\"Dining table:\" not \"Question 1:\")
   - Input fields styled like real IELTS answer sheets with shadows

4. **Configure Test Settings**
   - Set duration and difficulty
   - Add instructions matching IELTS format
   - Configure grading criteria

#### Grading Submissions

1. **Access Submissions**

   ```
   Dashboard → Submissions → Review
   ```

2. **Grade with Enhanced Tools**
   - Play audio submissions with full controls
   - View images in fullscreen
   - Use criteria-based rubrics
   - Provide detailed feedback

### 👨‍🎓 Student Workflow

#### Taking Listening Tests

1. **Access Available Tests**

   ```
   Dashboard → Tests → Available
   ```

2. **Experience Authentic IELTS Interface**

   - Clean, professional layout matching real IELTS papers
   - Box-style input fields with shadows
   - Drag-and-drop matching questions
   - Professional audio player controls

3. **Submit Answers**
   - **Text**: Clean input fields for short answers
   - **Matching**: Drag answer choices to match items
   - **Audio**: Record responses with playback preview
   - **Auto-save**: Automatic draft saving

## 🔒 Security

### 🛡️ Authentication & Authorization

- **JWT Token Management**: Secure token storage and refresh
- **Role-Based Access Control**: Student, edu_admin, super_admin roles
- **Route Protection**: Protected routes with role validation

### 🔐 Data Protection

- **Row Level Security (RLS)**: Database-level security policies
- **File Security**: Upload validation and access control
- **Data Encryption**: HTTPS/TLS and database encryption

## 🛠️ Troubleshooting

### 🔧 Common Issues

#### Build Issues

```bash
npm run typecheck        # Fix TypeScript errors
npm run format.fix       # Fix formatting issues
```

#### Runtime Issues

```bash
# Check environment variables
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Verify Supabase project status
```

#### Database Issues

```sql
-- Check user roles
SELECT role FROM profiles WHERE id = auth.uid();

-- Verify schema
\\d listening_questions
```

## 🤝 Contributing

**Built by [rasuljondev](https://github.com/rasuljondev)**

For questions, support, or collaboration, please reach out to the developer.

### 📝 Contribution Guidelines

- **TypeScript**: Use strict type checking
- **Prettier**: Auto-formatting on save
- **ESLint**: Follow configured rules
- **Testing**: Include tests for new functionality

### 🐛 Bug Reports

Use the GitHub issue template with:

- Clear bug description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

---

<div align="center">

## 🎉 Ready to Transform IELTS Testing!

This platform provides a complete, production-ready solution for authentic IELTS testing with advanced media management, real-time grading, and comprehensive submission tracking.

**Built with ❤️ by [rasuljondev](https://github.com/rasuljondev)**

[🚀 Get Started](#-getting-started) | [📖 Documentation](#-table-of-contents) | [🤝 Contribute](#-contributing)

</div>
