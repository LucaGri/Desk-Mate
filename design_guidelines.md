# Desk Mate Design Guidelines

## Design Approach
**Elegant Minimalism**: A refined, monochromatic palette with sophisticated serif typography creates a premium, professional aesthetic that inspires focus and productivity.

## Core Design Principles
1. **Trust through Clarity**: Every element reinforces reliability and professionalism
2. **Breathable Spaces**: Generous whitespace between sections creates premium feel
3. **Progressive Disclosure**: Information revealed thoughtfully as users scroll
4. **Data Visualization**: Charts and metrics presented elegantly to showcase AI capabilities

---

## Color System

**Primary Palette**:
- Background: #fafafa (very light gray, almost white)
- Foreground/Text: #434343 (dark charcoal gray)
- All accent colors derive from the same neutral gray spectrum

**Light Mode Values**:
- Background: HSL(0, 0%, 98%)
- Text: HSL(0, 0%, 26%)
- Cards: HSL(0, 0%, 100%)
- Borders: HSL(0, 0%, 88%)
- Muted Background: HSL(0, 0%, 94%)
- Muted Text: HSL(0, 0%, 35%) - ensures WCAG AA contrast
- Accent: HSL(0, 0%, 92%)

**Dark Mode Values**:
- Background: HSL(0, 0%, 10%)
- Text: HSL(0, 0%, 92%)
- Cards: HSL(0, 0%, 14%)
- Borders: HSL(0, 0%, 20%)

---

## Typography System

**Font Stack**: 
- Primary: 'Playfair Display' (Google Fonts) - all text, body, UI elements
- Fallback: Georgia, serif

**Hierarchy**:
- Hero Headline: text-6xl md:text-7xl, font-bold, tracking-tight, leading-tight
- Section Headers: text-4xl md:text-5xl, font-bold
- Feature Titles: text-2xl md:text-3xl, font-semibold
- Body Large: text-xl, leading-relaxed
- Body Standard: text-base md:text-lg, leading-relaxed
- Captions: text-sm, opacity-70

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 4, 8, 12, 16, 20, 24, 32
- Section padding: py-20 md:py-32
- Component spacing: gap-8 md:gap-12
- Inner content: px-4 md:px-8
- Element margins: mb-4, mb-8, mb-12

**Container Widths**:
- Full sections: w-full with max-w-7xl mx-auto
- Content sections: max-w-6xl mx-auto
- Text content: max-w-3xl mx-auto

**Grid System**: 
- Features: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Two-column layouts: grid-cols-1 lg:grid-cols-2
- Always single column on mobile

---

## Component Library

### Navigation
**Desktop Header**: Fixed top, backdrop-blur, subtle border-bottom
- Logo left: DESKMATE wordmark logo (dark gray on light, light gray on dark mode)
- Navigation links center: Features, Pricing, About
- CTA buttons right: "Sign In" (ghost), "Get Started" (primary)
- Height: h-16 md:h-20

**Logo**: The DESKMATE wordmark is stored at `/logo.png` - a clean, elegant typographic logo in the brand's charcoal gray color.

**Mobile**: Hamburger menu, slide-in drawer

### Hero Section (80vh min-height)
**Layout**: Two-column grid (lg:grid-cols-2)
- Left: Headline + subheadline + dual CTAs + trust badge ("Trusted by 1,000+ professionals")
- Right: Product screenshot or hero illustration showing dashboard interface

**Hero Image**: Large, high-quality mockup of Desk Mate dashboard showing calendar, meetings, and chat interface in action. Image should feel modern, clean, with soft shadows.

### Feature Sections

**Section 1 - Core Features Grid** (3 columns on desktop)
Cards with:
- Icon (Heroicons CDN, size-12)
- Feature title (text-xl font-semibold)
- Description (text-base)
- "Learn more →" link

Features to highlight:
1. AI Meeting Summaries (microphone icon)
2. Smart Time Management (calendar icon)
3. Personal Journal (book icon)
4. Contextual Chat (chat-bubble icon)

**Section 2 - Feature Deep Dive** (Alternating two-column)
Three subsections with image + content alternating left/right:
1. Meeting Intelligence: Screenshot of meeting summary interface
2. Your AI Assistant: Chat interface with context awareness
3. Analytics Dashboard: Productivity metrics visualization

Each with:
- Large heading
- 2-3 paragraph description
- Bullet points of specific capabilities
- Screenshot/illustration (rounded-xl, shadow-2xl)

**Section 3 - Social Proof**
- Centered testimonial cards (grid-cols-1 md:grid-cols-3)
- User avatar, quote, name, role
- Star ratings

**Section 4 - Final CTA**
Centered content (max-w-4xl):
- Bold headline: "Ready to transform your productivity?"
- Subtext about free trial
- Primary CTA button (large, prominent)
- Secondary text: "No credit card required"

### Footer
Multi-column layout (grid-cols-2 md:grid-cols-4):
- Column 1: Logo + tagline
- Column 2: Product links
- Column 3: Company links  
- Column 4: Newsletter signup form
- Bottom bar: Copyright, Privacy Policy, Terms, desk-mate.it domain

### Authentication Pages

**Login/Signup Page**:
- Centered card (max-w-md)
- Logo at top
- Form fields with generous spacing (gap-6)
- Email input + password input
- "Sign in with Google" button (with Google icon)
- Divider: "or continue with"
- Toggle between Sign In / Sign Up
- Minimal, focused layout - no distractions

---

## Images

1. **Hero Image**: Dashboard mockup showing calendar view with meeting cards, journal entries sidebar, and AI chat interface. Modern, clean UI with sample data. Should convey professionalism and capability.

2. **Meeting Summary Screenshot**: Interface showing AI-generated meeting summary with key points, action items, and transcript excerpt.

3. **Chat Interface**: AI assistant chat showing contextual responses about schedule, past meetings, and journal entries.

4. **Analytics Dashboard**: Visualization of productivity metrics - time distribution charts, meeting efficiency scores, task completion trends.

5. **Feature Icons**: Use Heroicons throughout for consistency.

---

## Interaction Patterns

**Buttons**:
- Primary: Solid background, rounded-lg, px-8 py-3, font-semibold
- Secondary: Border, transparent background, same padding
- On images: Backdrop-blur with semi-transparent background
- NO hover/active color changes needed (component handles this)

**Cards**: 
- Rounded-xl borders
- Subtle shadows (shadow-sm default, shadow-lg on hover)
- Padding: p-6 md:p-8
- Hover: Gentle lift effect (transform scale)

**Form Inputs**:
- Rounded-lg borders
- Generous padding (px-4 py-3)
- Clear focus states
- Helper text below inputs

**Animations**: Minimal, tasteful
- Fade-in on scroll for sections
- Smooth transitions (transition-all duration-300)
- NO complex scroll-triggered animations

---

## Responsive Behavior

**Mobile-First Approach**:
- Stack all multi-column layouts to single column
- Reduce font sizes by 1-2 steps
- Hero height: 100vh mobile, 80vh desktop
- Navigation collapses to hamburger
- Touch-friendly tap targets (min 44px height)

**Breakpoints**:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

This creates a professional, modern landing page that positions Desk Mate as a premium AI productivity tool while maintaining approachability and clarity.