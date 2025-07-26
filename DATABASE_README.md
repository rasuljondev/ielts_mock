# IELTS Platform Database Documentation

<div align="center">

![Database](https://img.shields.io/badge/Database-PostgreSQL-blue.svg)
![Supabase](https://img.shields.io/badge/Supabase-2.50.3-green.svg)
![RLS](https://img.shields.io/badge/Security-Row%20Level%20Security-red.svg)

Complete database schema and architecture documentation for the IELTS Testing Platform.

</div>

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [🏗️ Database Architecture](#️-database-architecture)
- [📊 Core Tables](#-core-tables)
- [🔐 Security Model](#-security-model)
- [📈 Performance Optimizations](#-performance-optimizations)
- [🚀 Setup Instructions](#-setup-instructions)
- [🔧 Migrations](#-migrations)
- [📖 Usage Examples](#-usage-examples)
- [🛠️ Troubleshooting](#️-troubleshooting)

## 🎯 Overview

The IELTS Platform uses **PostgreSQL** with **Supabase** for a modern, secure, and scalable database architecture. The system implements **Row Level Security (RLS)**, **multi-tenancy**, and **real-time capabilities** to support educational institutions worldwide.

### 🌟 Key Features

- **🔒 Row Level Security**: Automatic data isolation by role and organization
- **🏢 Multi-Tenant Architecture**: Support for multiple educational centers
- **⚡ Real-Time Updates**: Live submission tracking and grading
- **📊 JSONB Storage**: Flexible answer and metadata storage
- **🔍 Full-Text Search**: Advanced content search capabilities
- **📈 Performance Optimized**: Strategic indexes and query optimization

## 🏗️ Database Architecture

### 🎯 Design Principles

1. **Security First**: RLS policies protect data at the database level
2. **Multi-Tenancy**: Educational centers are completely isolated
3. **Flexibility**: JSONB fields for dynamic content and answers
4. **Performance**: Optimized indexes for common query patterns
5. **Auditability**: Comprehensive timestamps and user tracking

### 🏛️ Schema Overview

```
📊 Core Platform
├── edu_centers          # Educational institutions
├── profiles            # User management (extends auth.users)
├── tests               # Test definitions
└── test_media          # Media file management

📝 Test Content
├── writing_tasks       # Writing test prompts and tasks
├── reading_sections    # Reading passages and questions
├── reading_questions   # Reading question details
├── listening_sections  # Listening test sections
└── listening_questions # Listening question details

🎯 Student Workflow
├── test_requests      # Student test assignment requests
├── test_submissions   # Main submission tracking
├── answer_submissions # Detailed answer tracking
└── notifications      # System notifications

🔧 System
├── grading_criteria   # Assessment rubrics
└── test_assignment_groups # Group management
```

## 📊 Core Tables

### 🏢 `edu_centers` - Educational Institutions

Multi-tenant architecture foundation.

```sql
CREATE TABLE edu_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Isolate data between different educational institutions.
**RLS Policy**: Super admins see all, edu admins see only their center.

### 👥 `profiles` - User Management

Extends Supabase auth.users with platform-specific data.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'edu_admin', 'super_admin')),
    edu_center_id UUID REFERENCES edu_centers(id),
    phone TEXT,
    date_of_birth DATE,
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features**:

- **Role-Based Access**: Three distinct roles with different permissions
- **Center Association**: Users belong to specific educational centers
- **Profile Extension**: Additional data beyond basic authentication

### 📋 `tests` - Test Definitions

Core test configuration and metadata.

```sql
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('reading', 'writing', 'listening', 'speaking', 'full_test')),
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_minutes INTEGER DEFAULT 60,

    -- Organizational
    edu_center_id UUID NOT NULL REFERENCES edu_centers(id),
    created_by UUID NOT NULL REFERENCES auth.users(id),

    -- Publishing
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,

    -- Timing
    available_from TIMESTAMP WITH TIME ZONE,
    available_until TIMESTAMP WITH TIME ZONE,

    -- Configuration
    max_attempts INTEGER DEFAULT 1,
    show_results_immediately BOOLEAN DEFAULT true,
    allow_review BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Features**:

- **Type System**: Supports all IELTS test types
- **Publishing Workflow**: Draft → Published states
- **Scheduling**: Flexible availability windows
- **Configuration**: Customizable test behavior

### 📁 `test_media` - Media File Management

Comprehensive media storage and organization.

```sql
CREATE TABLE test_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    section_id UUID NULL,
    section_type TEXT CHECK (section_type IN ('writing', 'reading', 'listening')),

    -- File Information
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'audio', 'video', 'document')),
    file_size_bytes INTEGER,
    mime_type TEXT,

    -- Metadata
    title TEXT,
    description TEXT,
    duration_seconds INTEGER, -- For audio/video

    -- Management
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Features**:

- **Multi-Format Support**: Images, audio, video, documents
- **Section Association**: Link media to specific test sections
- **Metadata Tracking**: Comprehensive file information
- **Usage Monitoring**: Track uploads and usage

### 🎵 `listening_sections` & `listening_questions` - Listening Tests

Specialized schema for authentic IELTS listening tests.

```sql
-- Listening Sections
CREATE TABLE listening_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    instructions TEXT,
    content TEXT, -- HTML content with embedded questions
    audio_url TEXT,
    section_order INTEGER DEFAULT 1,

    -- Timing
    duration_minutes INTEGER DEFAULT 30,

    -- Management
    edu_center_id UUID NOT NULL REFERENCES edu_centers(id),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listening Questions
CREATE TABLE listening_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES listening_sections(id) ON DELETE CASCADE,

    -- Question Details
    question_number INTEGER NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN (
        'multiple_choice', 'short_answer', 'matching',
        'sentence_completion', 'map_labeling'
    )),
    question_text TEXT,
    question_order INTEGER DEFAULT 1,

    -- Answer Configuration
    options JSONB, -- For MCQ and matching options
    correct_answer TEXT,
    points_possible DECIMAL(4,2) DEFAULT 1.0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features**:

- **Authentic IELTS Format**: Supports all official question types
- **Smart Content Parsing**: HTML content with embedded interactive elements
- **Flexible Answers**: JSONB storage for complex answer structures
- **Question Ordering**: Precise control over question sequence

### 📝 `test_submissions` - Submission Tracking

Main submission lifecycle management.

```sql
CREATE TABLE test_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id),
    student_id UUID NOT NULL REFERENCES auth.users(id),

    -- Submission Data
    answers JSONB DEFAULT '{}', -- Legacy simple answers
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),

    -- Scoring
    total_score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    percentage_score DECIMAL(5,2),

    -- Enhanced Features
    has_media_answers BOOLEAN DEFAULT false,
    media_count INTEGER DEFAULT 0,

    -- Feedback
    feedback TEXT,
    graded_by UUID REFERENCES auth.users(id),

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_at TIMESTAMP WITH TIME ZONE,

    -- Management
    edu_center_id UUID NOT NULL REFERENCES edu_centers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(test_id, student_id) -- One submission per student per test
);
```

### 📋 `answer_submissions` - Detailed Answer Tracking

Enhanced answer storage with multi-media support.

```sql
CREATE TABLE answer_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_submission_id UUID NOT NULL REFERENCES test_submissions(id) ON DELETE CASCADE,

    -- Question Reference
    question_id TEXT NOT NULL, -- Can reference various question tables
    question_type TEXT NOT NULL CHECK (question_type IN ('text', 'audio', 'image', 'file')),

    -- Student Information
    student_id UUID NOT NULL REFERENCES auth.users(id),

    -- Answer Data
    answer_text TEXT,
    answer_file_url TEXT,
    answer_metadata JSONB DEFAULT '{}', -- Additional answer information

    -- Grading
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
    score DECIMAL(5,2),
    max_score DECIMAL(5,2) DEFAULT 1.0,
    feedback TEXT,
    criteria_scores JSONB DEFAULT '[]', -- Detailed rubric scores

    -- Timing
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Advanced Features**:

- **Multi-Media Answers**: Text, audio, image, file support
- **Criteria-Based Grading**: Detailed rubric scoring
- **Metadata Storage**: Flexible additional information
- **Individual Tracking**: Each answer separately managed

## 🔐 Security Model

### 🛡️ Row Level Security (RLS)

All tables implement RLS policies for automatic data protection.

#### 🏢 Multi-Tenant Isolation

```sql
-- Example: Tests table policy
CREATE POLICY "Users can only access tests from their edu center"
ON tests FOR ALL
USING (
    CASE
        WHEN auth.jwt() ->> 'role' = 'super_admin' THEN true
        ELSE edu_center_id = (
            SELECT edu_center_id
            FROM profiles
            WHERE id = auth.uid()
        )
    END
);
```

#### 👥 Role-Based Access

**Super Admin**:

- Full platform access
- All educational centers
- System configuration

**Educational Admin**:

- Own center's data only
- Test creation and management
- Student grading and feedback

**Student**:

- Own submissions only
- Assigned tests only
- Personal profile data

### 🔒 Storage Security

#### 📁 Bucket Policies

```sql
-- Test files bucket policy
CREATE POLICY "Authenticated users can upload test files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'test-files'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view test files from their center"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'test-files'
    AND EXISTS (
        SELECT 1 FROM test_media tm
        JOIN tests t ON tm.test_id = t.id
        WHERE tm.file_url LIKE '%' || name || '%'
        AND t.edu_center_id = (
            SELECT edu_center_id
            FROM profiles
            WHERE id = auth.uid()
        )
    )
);
```

## 📈 Performance Optimizations

### 🚀 Strategic Indexes

```sql
-- High-traffic query optimization
CREATE INDEX CONCURRENTLY idx_profiles_edu_center
    ON profiles(edu_center_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_tests_published
    ON tests(edu_center_id, is_published, type)
    WHERE is_published = true;

CREATE INDEX CONCURRENTLY idx_submissions_student_status
    ON test_submissions(student_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_listening_questions_section
    ON listening_questions(section_id, question_order);

-- JSONB optimization for answers
CREATE INDEX CONCURRENTLY idx_submissions_answers_gin
    ON test_submissions USING GIN (answers);

CREATE INDEX CONCURRENTLY idx_answer_metadata_gin
    ON answer_submissions USING GIN (answer_metadata);
```

### 📊 Query Optimization

#### 🔍 Materialized Views

```sql
-- Pre-computed submission statistics
CREATE MATERIALIZED VIEW submission_stats AS
SELECT
    t.edu_center_id,
    t.id as test_id,
    COUNT(ts.id) as total_submissions,
    COUNT(CASE WHEN ts.status = 'submitted' THEN 1 END) as submitted_count,
    COUNT(CASE WHEN ts.status = 'graded' THEN 1 END) as graded_count,
    AVG(ts.percentage_score) as avg_score
FROM tests t
LEFT JOIN test_submissions ts ON t.id = ts.test_id
GROUP BY t.edu_center_id, t.id;

-- Refresh periodically
CREATE OR REPLACE FUNCTION refresh_submission_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW submission_stats;
END;
$$ LANGUAGE plpgsql;
```

#### 🎯 Optimized Queries

```sql
-- Efficient student dashboard query
SELECT
    t.id,
    t.title,
    t.type,
    t.duration_minutes,
    ts.status,
    ts.percentage_score,
    ts.submitted_at
FROM tests t
LEFT JOIN test_submissions ts ON t.id = ts.test_id
    AND ts.student_id = auth.uid()
WHERE t.edu_center_id = (
    SELECT edu_center_id FROM profiles WHERE id = auth.uid()
)
AND t.is_published = true
AND (t.available_from IS NULL OR t.available_from <= NOW())
AND (t.available_until IS NULL OR t.available_until >= NOW())
ORDER BY t.created_at DESC;
```

## 🚀 Setup Instructions

### 📋 Prerequisites

- **Supabase Project**: Active Supabase project
- **PostgreSQL**: Version 13+ (handled by Supabase)
- **psql**: Command line tool for SQL execution

### ⚙️ Installation Steps

1. **Clone and Setup Environment**

```bash
git clone <repository>
cd ielts-platform
cp .env.example .env.local
```

2. **Configure Supabase Connection**

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Execute Database Setup**

```bash
# Complete schema setup
psql -h db.your-project.supabase.co -U postgres -d postgres -f database_setup.sql

# Apply any schema fixes
psql -h db.your-project.supabase.co -U postgres -d postgres -f fix_listening_questions_schema.sql
```

4. **Verify Installation**

```sql
-- Check tables exist
\\dt

-- Verify RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Test storage buckets
SELECT name FROM storage.buckets;
```

### 🔧 Post-Setup Configuration

#### 🏢 Create First Educational Center

```sql
INSERT INTO edu_centers (name, description, city, country)
VALUES ('Demo Education Center', 'Test institution for platform setup', 'New York', 'USA');
```

#### 👤 Create Super Admin User

```sql
-- First, user must sign up through the application
-- Then update their role
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'admin@example.com';
```

## 🔧 Migrations

### 📝 Migration Strategy

The platform uses a **consolidated migration approach**:

1. **Main Schema**: `database_setup.sql` - Complete schema for new installations
2. **Fixes**: `fix_*.sql` - Specific fixes for existing installations
3. **Custom Migrations**: `sql/` directory for additional changes

### 🚀 Creating New Migrations

1. **Create Migration File**

```bash
touch sql/$(date +%Y%m%d)_description.sql
```

2. **Write Migration**

```sql
-- sql/20241215_add_speaking_tests.sql
-- Add speaking test support

CREATE TABLE speaking_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 3),
    task_type TEXT NOT NULL,
    instructions TEXT NOT NULL,
    time_limit_seconds INTEGER DEFAULT 180,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE speaking_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"speaking_tasks_tenant_isolation\"
ON speaking_tasks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM tests
        WHERE id = speaking_tasks.test_id
        AND edu_center_id = (
            SELECT edu_center_id FROM profiles WHERE id = auth.uid()
        )
    )
);
```

3. **Test Migration**

```bash
psql -h your_host -U postgres -d postgres -f sql/20241215_add_speaking_tests.sql
```

4. **Update Main Schema**
   Add the new tables to `database_setup.sql` for future installations.

## 📖 Usage Examples

### 👨‍🎓 Student Queries

#### 📋 Get Available Tests

```sql
SELECT
    t.id,
    t.title,
    t.type,
    t.description,
    t.duration_minutes,
    CASE
        WHEN ts.id IS NULL THEN 'not_started'
        ELSE ts.status
    END as submission_status,
    ts.percentage_score
FROM tests t
LEFT JOIN test_submissions ts ON t.id = ts.test_id
    AND ts.student_id = auth.uid()
WHERE t.edu_center_id = (
    SELECT edu_center_id FROM profiles WHERE id = auth.uid()
)
AND t.is_published = true
ORDER BY t.created_at DESC;
```

#### 💾 Save Listening Answer

```sql
-- Insert or update student answer
INSERT INTO answer_submissions (
    test_submission_id,
    question_id,
    question_type,
    student_id,
    answer_text,
    answer_metadata
) VALUES (
    $1, -- test_submission_id
    $2, -- question_id
    'text',
    auth.uid(),
    $3, -- answer_text
    jsonb_build_object(
        'question_number', $4,
        'section_id', $5,
        'timestamp', NOW()
    )
) ON CONFLICT (test_submission_id, question_id)
DO UPDATE SET
    answer_text = EXCLUDED.answer_text,
    answer_metadata = EXCLUDED.answer_metadata,
    created_at = NOW();
```

### 🎓 Educational Admin Queries

#### 📊 Get Submission Statistics

```sql
SELECT
    t.title,
    COUNT(ts.id) as total_submissions,
    COUNT(CASE WHEN ts.status = 'submitted' THEN 1 END) as submitted,
    COUNT(CASE WHEN ts.status = 'graded' THEN 1 END) as graded,
    ROUND(AVG(ts.percentage_score), 2) as avg_score
FROM tests t
LEFT JOIN test_submissions ts ON t.id = ts.test_id
WHERE t.edu_center_id = (
    SELECT edu_center_id FROM profiles WHERE id = auth.uid()
)
AND t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY t.id, t.title
ORDER BY total_submissions DESC;
```

#### 🎵 Create Listening Question

```sql
INSERT INTO listening_questions (
    section_id,
    question_number,
    question_type,
    question_text,
    options,
    correct_answer,
    points_possible
) VALUES (
    $1, -- section_id
    $2, -- question_number
    'matching',
    $3, -- question_text
    jsonb_build_object(
        'left', ARRAY['Dining table', 'Chairs', 'Bookshelf'],
        'right', ARRAY['Oak wood', 'Leather', 'Pine wood', 'Metal', 'Plastic']
    ),
    jsonb_build_object(
        'Dining table', 'Oak wood',
        'Chairs', 'Leather',
        'Bookshelf', 'Pine wood'
    ),
    3.0 -- 3 points total for matching question
);
```

### 🏢 Super Admin Queries

#### 📈 Platform Statistics

```sql
SELECT
    (SELECT COUNT(*) FROM edu_centers WHERE is_active = true) as active_centers,
    (SELECT COUNT(*) FROM profiles WHERE role = 'student') as total_students,
    (SELECT COUNT(*) FROM profiles WHERE role = 'edu_admin') as total_admins,
    (SELECT COUNT(*) FROM tests WHERE is_published = true) as published_tests,
    (SELECT COUNT(*) FROM test_submissions WHERE status = 'submitted') as total_submissions;
```

#### 🎯 Center Performance Analysis

```sql
SELECT
    ec.name as center_name,
    COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'student') as student_count,
    COUNT(DISTINCT t.id) as tests_created,
    COUNT(DISTINCT ts.id) as total_submissions,
    ROUND(AVG(ts.percentage_score), 2) as avg_score
FROM edu_centers ec
LEFT JOIN profiles p ON ec.id = p.edu_center_id AND p.is_active = true
LEFT JOIN tests t ON ec.id = t.edu_center_id AND t.is_published = true
LEFT JOIN test_submissions ts ON t.id = ts.test_id AND ts.status = 'graded'
WHERE ec.is_active = true
GROUP BY ec.id, ec.name
ORDER BY student_count DESC;
```

## 🛠️ Troubleshooting

### 🚨 Common Issues

#### 🔒 RLS Policy Problems

**Issue**: \"permission denied for table\"

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'your_table';

-- Check policies exist
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'your_table';

-- Test user context
SELECT
    auth.uid() as user_id,
    auth.jwt() ->> 'role' as user_role,
    (SELECT edu_center_id FROM profiles WHERE id = auth.uid()) as center_id;
```

#### 📊 Performance Issues

**Issue**: Slow queries

```sql
-- Identify slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Analyze specific query
EXPLAIN ANALYZE SELECT ...;
```

#### 🗄️ Schema Issues

**Issue**: Missing tables or columns

```sql
-- Check current schema version
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;

-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check specific column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'your_table';
```

### 📞 Support Resources

#### 🔧 Database Tools

- **pgAdmin**: GUI database management
- **Supabase Dashboard**: Web-based database explorer
- **psql**: Command-line interface

#### 📚 Documentation Links

- [Supabase Documentation](https://supabase.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.io/docs/guides/auth/row-level-security)

---

<div align=\"center\">

## 🎉 Database Ready for Production!

This comprehensive database architecture supports scalable, secure, and high-performance IELTS testing with complete multi-tenancy and real-time capabilities.

**Built with 💾 for Educational Excellence**

[🚀 Setup Guide](#-setup-instructions) | [📖 Main Documentation](README.md) | [🔧 Troubleshooting](#️-troubleshooting)

</div>
