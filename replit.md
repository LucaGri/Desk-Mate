# Desk Mate - AI Productivity Assistant

## Overview

Desk Mate is an AI-powered productivity application designed for professionals. It integrates calendar management, meeting intelligence (transcription and summarization), personal journaling with mood tracking, and a contextual AI chat assistant. The platform aims to enhance time management, meeting effectiveness, and personal development through a clean, modern user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React with TypeScript, Vite for fast development.
- **UI:** shadcn/ui (Radix UI + Tailwind CSS) with a "New York" style design system, custom theming (light/dark mode), and consistent typography.
- **State Management:** React hooks for local state, TanStack Query for server state, custom `useAuth` hook for authentication.
- **Routing:** Wouter handles client-side routing for marketing, authentication, onboarding, dashboard, calendar, journal, analysis, AI assistant, profile, and event views. Protected routes enforce authentication and onboarding status.

### Backend
- **Server:** Express.js, designed for RESTful API interactions (`/api` prefix).
- **Data Layer:** Currently uses in-memory storage, with a planned migration to PostgreSQL via Drizzle ORM.
- **Development vs. Production:** Vite integration for development, serving static files in production.

### Data Storage
- **Primary Database:** Supabase (PostgreSQL) for user profiles, settings, events, tasks, journal entries, and AI-related data.
- **Future Database:** Neon serverless PostgreSQL with Drizzle ORM is configured for potential integration.

### Authentication and Authorization
- **Authentication:** Supabase Auth with email/password and Google OAuth, managed by a custom `useAuth` hook.
- **Authorization:** Role-based access and protected routes based on authentication and onboarding completion.
- **Onboarding:** A 3-step wizard collects user preferences (personal info, calendar settings) and stores them in `profiles`.

### Core Features

#### Calendar
- **Views:** Month, Week, Day views with customizable start day (Monday).
- **Settings:** Configurable work hours and default view based on user preferences.
- **Navigation:** Buttons for previous/next periods and returning to today, plus view switcher tabs.

#### Journal
- **Mood Tracking:** 5-level mood system (Terrible to Great) with icons and scores (1-5).
- **Daily Entries:** Free-form text, inspiration prompts, and a tag system.
- **History:** Card-based display of past entries with mood indicators and tag badges.
- **Schema:** `journal_entries` table stores date, mood, text, and tags.

#### Google Calendar Integration
- **Import:** One-way, manual import of events from selected Google Calendars into Desk Mate, with conflict detection.
- **OAuth:** Secure OAuth flow with encrypted token storage and refresh token handling.
- **Tracking:** Imported events are tagged with their Google source and original IDs.

#### Analytics
- **Dashboard:** Comprehensive productivity insights at `/analysis` with date range filtering.
- **Sections:** Overview (Productivity Score, Journal/Event counts), Mood (trends, distribution, top tags), Calendar (event breakdown, busy days), and Insights (correlations, personalized recommendations).
- **Visualizations:** Uses `recharts` for dynamic graphs and charts.

#### AI Assistant
- **Contextual Chat:** AI chat powered by OpenAI GPT-4o-mini, using user's OpenAI API key stored in Replit Secrets (OPENAI_API_KEY).
- **Context Sources:** User-configurable via Profile page. Supports Calendar, Journal, Meetings, and Analytics as context sources.
- **AI Settings:** Profile page has dedicated AI Assistant Settings card with toggles for each context source.
- **Conversation Management:** Persistent chat history stored in Supabase (`ai_conversations`, `ai_messages`, `ai_settings`).
- **AI Sidebar:** Collapsible sidebar panel accessible from Dashboard, Calendar, Journal, and Analysis pages via sparkles icon button.
- **Dedicated Assistant Page:** Full-featured chat interface at `/assistant` with conversation history, new conversation creation, and context source selection.
- **Meeting Intelligence:**
    - **Transcription:** Upload audio files in Event Dialog → Whisper API processes → transcription saved to `transcriptions` table.
    - **Summaries:** GPT-4o-mini generates structured summaries (key points, action items, decisions) from transcriptions, stored in `meeting_summaries` table.
    - **UI:** Collapsible sections in Event Dialog show transcription text, key points, action items, and decisions.

#### Important Setup Notes
- **Supabase Tables:** Run `supabase-ai-tables.sql` in Supabase SQL Editor to create required AI tables before using AI features.
- **Environment Variables:** OPENAI_API_KEY must be set in Replit Secrets for AI features to work.

### Internationalization (i18n)
- Full support for 5 languages (EN, IT, DE, FR, ES) across all UI elements, prompts, and AI features.

## External Dependencies

### Core Services
- **Supabase:** Backend-as-a-Service for authentication, PostgreSQL database, and real-time capabilities.

### Database
- **Neon Database:** Serverless PostgreSQL for potential future use.

### Development Tools
- **Replit Integration:** Runtime error modal, Cartographer, Dev banner.
- **Vite:** Frontend bundling and development server.

### UI & Styling
- **Radix UI:** Headless component primitives.
- **Tailwind CSS:** Utility-first CSS framework.
- **class-variance-authority:** Component variant management.
- **Lucide React:** Icon library.
- **Google Fonts:** Inter font family.

### Data Handling & Forms
- **TanStack Query:** Asynchronous state management.
- **React Hook Form:** Form state and validation.
- **Zod:** Schema validation.

### AI & Speech
- **OpenAI API:** For GPT-4o-mini (chat, summarization) and Whisper (transcription).