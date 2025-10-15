# WagerProof Design Language & Component Library

**Version:** 1.0  
**Last Updated:** October 2025  
**Purpose:** Reference guide for LLMs and developers building new features in WagerProof

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Technology Stack](#technology-stack)
3. [Design System](#design-system)
4. [Component Library](#component-library)
5. [Animation & Motion](#animation--motion)
6. [Typography](#typography)
7. [Layout Patterns](#layout-patterns)
8. [Form Patterns](#form-patterns)
9. [Data Visualization](#data-visualization)
10. [Best Practices](#best-practices)

---

## Core Philosophy

WagerProof is a **modern, premium sports betting analytics platform** with a focus on:

- **Data-Driven Excellence**: Clear, actionable insights with sophisticated data visualization
- **Premium Aesthetics**: Glassmorphism, aurora effects, animated borders, and smooth transitions
- **Dark Mode First**: Elegant dark themes with vibrant accent colors (honeydew/green palette)
- **Responsive & Mobile**: Graceful degradation across all devices
- **Performance**: Smooth 60fps animations with hardware acceleration
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation

### Visual Identity

- **Primary Brand Color**: Honeydew green (`#22c55e`, `#4ade80`) - represents growth, success, data accuracy
- **Secondary Colors**: Purple/Indigo for betting, Pink/Rose for dates, Cyan/Blue for situational data
- **Dark Mode**: True black/near-black backgrounds with high contrast
- **Light Mode**: Crisp whites with subtle grays

---

## Technology Stack

### Core Framework
```json
{
  "framework": "React 18.3.1",
  "language": "TypeScript 5.5.3",
  "build": "Vite 5.4.1",
  "routing": "React Router DOM 6.26.2"
}
```

### UI Component Libraries
```json
{
  "base": "Radix UI (Headless Components)",
  "styling": "Tailwind CSS 3.4.11",
  "icons": [
    "Lucide React 0.462.0",
    "Tabler Icons React 3.35.0",
    "Phosphor React 1.4.1"
  ]
}
```

### Animation & Effects
```json
{
  "motion": "Motion (Framer Motion) 12.23.24",
  "3d": "GSAP 3.13.0 + @gsap/react 2.1.2",
  "webgl": "OGL 1.0.11 (for Aurora effects)",
  "lottie": "Lottie React 2.4.1",
  "smooth-scroll": "Lenis 1.3.11"
}
```

### State Management & Data
```json
{
  "queries": "TanStack React Query 5.56.2",
  "forms": "React Hook Form 7.53.0 + Zod 3.23.8",
  "backend": "Supabase JS 2.50.0"
}
```

### Utility Libraries
```json
{
  "class-utilities": "clsx 2.1.1 + tailwind-merge 2.5.2",
  "variants": "class-variance-authority 0.7.1",
  "dates": "date-fns 3.6.0 + date-fns-tz 3.2.0",
  "charts": "Recharts 2.12.7",
  "notifications": "Sonner 1.5.0"
}
```

---

## Design System

### Color Palette

#### CSS Variables (Light Mode)
```css
:root {
  --background: 0 0% 100%;        /* Pure white */
  --foreground: 0 0% 10%;         /* Near black */
  --primary: 245 58% 61%;         /* Brand purple */
  --secondary: 0 0% 96.1%;        /* Light gray */
  --muted: 0 0% 96.1%;           /* Subtle background */
  --accent: 0 0% 96.1%;          /* Accent background */
  --destructive: 0 84.2% 60.2%;  /* Error red */
  --border: 0 0% 91%;            /* Borders */
  --input: 0 0% 91%;             /* Input borders */
  --ring: 245 58% 61%;           /* Focus rings */
  --radius: 0.75rem;             /* 12px default border radius */
}
```

#### CSS Variables (Dark Mode)
```css
.dark {
  --background: 0 0% 12%;         /* True dark */
  --foreground: 0 0% 96%;         /* Almost white */
  --primary: 245 58% 61%;         /* Consistent brand */
  --secondary: 0 0% 18%;          /* Dark gray */
  --muted: 0 0% 18%;             /* Dark subtle */
  --accent: 0 0% 18%;            /* Dark accent */
  --destructive: 0 62.8% 50.6%;  /* Deeper error */
  --border: 0 0% 20%;            /* Dark borders */
  --input: 0 0% 20%;             /* Dark inputs */
}
```

#### Semantic Colors (Tailwind Extensions)
```typescript
{
  primary: '#1b2b49',        // Deep navy
  muted: '#58585c',          // Gray
  accent: '#f7d648',         // Yellow accent
  success: '#7ac268',        // Green success
  info: '#6db8e0',          // Info blue
  
  // Honeydew scale (primary brand)
  honeydew: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  }
}
```

#### Gradient Presets

```css
/* Filter Section Gradients */
.filter-section-betting {
  @apply bg-gradient-to-br from-purple-50 to-indigo-50 border-l-4 border-purple-500;
}

.filter-section-date {
  @apply bg-gradient-to-br from-pink-50 to-rose-50 border-l-4 border-pink-500;
}

.filter-section-situational {
  @apply bg-gradient-to-br from-cyan-50 to-blue-50 border-l-4 border-cyan-500;
}

/* Text Gradients */
.gradient-text-betting {
  @apply bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent;
}

.gradient-text-date {
  @apply bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent;
}

.gradient-text-situational {
  @apply bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent;
}

/* CSS Variable Gradients */
--betting-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--date-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
--situational-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
--success-gradient: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
--warning-gradient: linear-gradient(135deg, #fceabb 0%, #f8b500 100%);
```

---

## Component Library

### Base Components (Radix UI + Tailwind)

#### Button
**Location:** `src/components/ui/button.tsx`

```tsx
import { Button } from "@/components/ui/button";

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon Only</Button>
```

**Usage Pattern:**
- Use `default` for primary actions
- Use `outline` for secondary actions
- Use `ghost` for tertiary/subtle actions
- Use `destructive` only for delete/remove actions

#### Card
**Location:** `src/components/ui/card.tsx`

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle or description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Actions or metadata */}
  </CardFooter>
</Card>
```

**Default Styling:**
- Border radius: `rounded-lg` (12px)
- Border: `border` (1px solid)
- Background: `bg-card` (theme-aware)
- Shadow: `shadow-sm`

#### Input
**Location:** `src/components/ui/input.tsx`

```tsx
import { Input } from "@/components/ui/input";

<Input 
  type="email"
  placeholder="you@example.com"
  disabled={false}
  required
/>
```

**Default Styling:**
- Height: `h-10`
- Border radius: `rounded-md`
- Border: `border-input`
- Focus ring: `focus-visible:ring-2 ring-ring`

### Advanced UI Components (Magic UI)

#### Aurora Effect
**Location:** `src/components/magicui/aurora.tsx`

WebGL-powered animated gradient background using OGL library.

```tsx
import Aurora from '@/components/magicui/aurora';

<Aurora
  colorStops={['#5227FF', '#7cff67', '#5227FF']}
  amplitude={1.2}      // Wave intensity (0-2)
  blend={0.6}          // Color blend factor (0-1)
  speed={0.8}          // Animation speed multiplier
/>
```

**When to Use:**
- Hero sections
- Premium card hover states
- Highlight important game cards (team colors)
- Background accents for featured content

**Performance:** Uses WebGL shaders, optimized for 60fps

#### Shine Border
**Location:** `src/components/magicui/shine-border.tsx`

Animated rotating gradient border effect.

```tsx
import ShineBorder from '@/components/magicui/shine-border';

<ShineBorder
  borderRadius={12}
  borderWidth={1}
  duration={18}
  color={["#93c5fd", "#c4b5fd", "#93c5fd"]}
  className="relative z-10 bg-transparent"
>
  {children}
</ShineBorder>
```

**When to Use:**
- Game cards (NFL/CFB)
- Premium feature highlights
- Interactive elements that need attention

#### Light Rays
**Location:** `src/components/magicui/light-rays.tsx`

Animated light beam effect that follows mouse.

```tsx
import LightRays from '@/components/magicui/light-rays';

<LightRays
  raysOrigin="top-center"
  raysColor="#39ff14"
  raysSpeed={1}
  lightSpread={0.5}
  rayLength={3.0}
  pulsating={true}
  fadeDistance={1.0}
  saturation={1.0}
  followMouse={true}
  mouseInfluence={0.6}
  opacity={0.95}
  additive={true}
/>
```

**When to Use:**
- Landing page hero backgrounds
- Full-page feature sections
- Behind main content as ambient effect

#### Moving Border Button
**Location:** `src/components/ui/moving-border.tsx`

Button with animated border gradient.

```tsx
import { Button as MovingBorderButton } from "@/components/ui/moving-border";

<MovingBorderButton
  borderRadius="1.5rem"
  containerClassName="h-16 w-auto"
  className="bg-white dark:bg-gray-900 text-honeydew-600"
  borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
  duration={2500}
>
  See Today's Games
</MovingBorderButton>
```

**When to Use:**
- Primary CTAs on landing page
- Important action buttons
- Feature highlights

#### Gradient Text
**Location:** `src/components/ui/gradient-text.tsx`

Animated gradient text with smooth transitions.

```tsx
import { GradientText } from "@/components/ui/gradient-text";

<GradientText 
  text="Betting Edge" 
  gradient="linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)"
  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
  className="font-bold"
/>
```

#### Marquee
**Location:** `src/components/magicui/marquee.tsx`

Infinite scrolling ticker with customizable direction.

```tsx
import Marquee from "@/components/magicui/marquee";

<Marquee
  pauseOnHover
  className="[--duration:20s]"
  reverse={false}
>
  {items.map(item => <div key={item.id}>{item.content}</div>)}
</Marquee>
```

**CSS Custom Properties:**
```css
.animate-marquee {
  animation: marquee var(--duration) linear infinite;
}
```

### Advanced Animata Components

**Location:** `src/animata/*`

Pre-built animated components for common patterns:

- `text/counter.tsx` - Animated number counters
- `text/ticker.tsx` - Live ticker displays
- `text/typing-text.tsx` - Typewriter effect
- `list/avatar-list.tsx` - Stacked avatar display
- `skeleton/report.tsx` - Loading skeleton for reports
- `skeleton/wide-card.tsx` - Loading skeleton for cards
- `graphs/bar-chart.tsx` - Animated bar charts

---

## Animation & Motion

### Animation Library: Motion (Framer Motion)

**Core Principles:**
1. **Subtle & Purposeful**: Animations enhance UX, not distract
2. **Performance**: Use `transform` and `opacity` for 60fps
3. **Duration**: 150-500ms for micro-interactions, 500-1000ms for page transitions
4. **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` for most animations

### Common Animation Patterns

#### Hover Scale
```tsx
import { motion } from "motion/react";

<motion.div
  whileHover={{ 
    scale: 1.015,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
  }}
  whileTap={{ scale: 0.995 }}
>
  {children}
</motion.div>
```

#### Fade In
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.5, ease: "easeInOut" }}
>
  {children}
</motion.div>
```

#### Slide In
```tsx
<motion.div
  initial={{ x: -20, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  {children}
</motion.div>
```

#### Stagger Children
```tsx
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### GSAP Animations

Use GSAP for:
- Complex timeline animations
- ScrollTrigger effects
- High-performance canvas animations

```tsx
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const Component = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    gsap.from(".animate-element", {
      opacity: 0,
      y: 50,
      duration: 1,
      stagger: 0.2
    });
  }, { scope: containerRef });
  
  return <div ref={containerRef}>...</div>;
};
```

### Tailwind Animation Classes

```css
/* Pulse glow effect */
.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}
```

### View Transitions API

Theme switching uses native View Transitions for smooth morphing:

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

:root {
  view-transition-name: root;
}
```

---

## Typography

### Font Families

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 
               'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

/* Extended font family for headlines */
.font-inter {
  font-family: 'Inter', sans-serif;
}
```

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-7xl` | 72px | 800 | Hero headlines |
| `text-6xl` | 60px | 800 | Page headers |
| `text-5xl` | 48px | 700 | Section headers |
| `text-4xl` | 36px | 700 | Large headings |
| `text-3xl` | 30px | 700 | Card headers |
| `text-2xl` | 24px | 600 | Subheadings |
| `text-xl` | 20px | 600 | Large body |
| `text-lg` | 18px | 500 | Emphasized body |
| `text-base` | 16px | 400 | Body text |
| `text-sm` | 14px | 400 | Small text |
| `text-xs` | 12px | 400 | Captions |

### Text Colors

```tsx
// Primary text
<p className="text-gray-900 dark:text-gray-100">

// Secondary text
<p className="text-gray-600 dark:text-gray-300">

// Muted text
<p className="text-gray-500 dark:text-gray-400">

// Success
<p className="text-green-600 dark:text-green-400">

// Error
<p className="text-red-600 dark:text-red-400">

// Brand
<p className="text-honeydew-600 dark:text-honeydew-400">
```

---

## Layout Patterns

### App Structure

```
<BrowserRouter>
  <AuthProvider>
    <ThemeProvider>
      <SidebarProvider>
        <AppLayout>           <!-- Sidebar -->
          <SidebarInset>
            <MinimalHeader />  <!-- Top nav -->
            <main>
              {/* Page content */}
            </main>
          </SidebarInset>
        </AppLayout>
      </SidebarProvider>
    </ThemeProvider>
  </AuthProvider>
</BrowserRouter>
```

### Responsive Grid Patterns

```tsx
// Two-column responsive
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">

// Three-column responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Auto-fit cards
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Sidebar + main content
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <aside className="lg:col-span-1">{/* Sidebar */}</aside>
  <main className="lg:col-span-3">{/* Main */}</main>
</div>
```

### Spacing Scale

Use consistent spacing from Tailwind's scale:

```tsx
// Tight spacing: 2-4 (8px-16px)
<div className="space-y-2">

// Normal spacing: 4-6 (16px-24px)
<div className="space-y-4">

// Loose spacing: 8-12 (32px-48px)
<div className="space-y-8">

// Section spacing: 12-16 (48px-64px)
<section className="py-12 md:py-16">
```

### Container Patterns

```tsx
// Max-width container
<div className="max-w-7xl mx-auto px-4 md:px-6">

// Full-width section with contained content
<section className="w-full">
  <div className="max-w-7xl mx-auto px-4">
    {children}
  </div>
</section>

// Card grid container
<div className="max-w-7xl mx-auto px-4">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {cards}
  </div>
</div>
```

---

## Form Patterns

### Form Library: React Hook Form + Zod

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });
  
  const onSubmit = (data: z.infer<typeof schema>) => {
    console.log(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Modern Auth Form Pattern

**Location:** `src/components/ModernAuthForm.tsx`

Key features:
- Gradient background effects
- Bottom gradient on hover
- Social auth buttons with icons
- Loading states
- Error/success alerts
- Mode switching (login/signup)

```tsx
import { ModernAuthForm } from "@/components/ModernAuthForm";

<ModernAuthForm
  onSubmit={handleSubmit}
  onGoogleSignIn={handleGoogle}
  onAppleSignIn={handleApple}
  isLoading={loading}
  error={error}
  success={success}
  mode={mode}
  onModeChange={setMode}
/>
```

### Input Patterns

```tsx
// Email input
<Input type="email" placeholder="you@example.com" required />

// Password input
<Input type="password" placeholder="••••••••" required />

// Number input
<Input type="number" min={0} max={100} step={1} />

// Disabled state
<Input disabled value="Read only" />

// With label
<Label htmlFor="email">Email Address</Label>
<Input id="email" type="email" />
```

### Select/Dropdown

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

<Select onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Switch/Toggle

```tsx
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

<div className="flex items-center space-x-2">
  <Switch id="notifications" checked={enabled} onCheckedChange={setEnabled} />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

---

## Data Visualization

### Charts: Recharts

**Location:** Used in analytics pages

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

### Confidence Meters

**Location:** `src/components/ConfidenceMeter.tsx`

Visual representation of prediction confidence.

### Progress Indicators

```tsx
import { Progress } from "@/components/ui/progress";

<Progress value={65} className="w-full" />
```

### Stat Cards

Pattern for displaying key metrics:

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardDescription>Win Rate</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold text-honeydew-600">68.3%</div>
    <p className="text-sm text-muted-foreground mt-1">
      +2.4% from last week
    </p>
  </CardContent>
</Card>
```

---

## Best Practices

### Component Structure

```tsx
// 1. Imports (grouped)
import React from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onAction: () => void;
  className?: string;
}

// 3. Component
export function MyComponent({ title, onAction, className }: MyComponentProps) {
  // 4. Hooks
  const [state, setState] = useState(false);
  
  // 5. Handlers
  const handleClick = () => {
    setState(true);
    onAction();
  };
  
  // 6. Render
  return (
    <div className={cn("base-classes", className)}>
      <h2>{title}</h2>
      <Button onClick={handleClick}>Action</Button>
    </div>
  );
}
```

### Styling Best Practices

1. **Use `cn()` utility for conditional classes:**
```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  variant === "primary" && "primary-class",
  className
)} />
```

2. **Prefer Tailwind over custom CSS:**
```tsx
// Good
<div className="flex items-center gap-4 p-6 rounded-lg bg-card">

// Avoid (unless necessary)
<div style={{ display: 'flex', padding: '24px' }}>
```

3. **Use semantic color tokens:**
```tsx
// Good
<p className="text-foreground">

// Avoid
<p className="text-black dark:text-white">
```

4. **Responsive design mobile-first:**
```tsx
<div className="text-sm md:text-base lg:text-lg">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### Performance Optimization

1. **Lazy load routes:**
```tsx
const LazyPage = lazy(() => import("./pages/HeavyPage"));

<Suspense fallback={<Loading />}>
  <LazyPage />
</Suspense>
```

2. **Memoize expensive components:**
```tsx
const MemoizedCard = memo(ExpensiveCard);
```

3. **Use TanStack Query for data:**
```tsx
import { useQuery } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ['games'],
  queryFn: fetchGames
});
```

4. **Optimize animations:**
```tsx
// Use transform & opacity (GPU accelerated)
<motion.div
  style={{ willChange: 'transform' }}
  animate={{ x: 100, opacity: 1 }}
/>

// Avoid animating width, height, top, left
```

### Accessibility

1. **Semantic HTML:**
```tsx
<nav>
<main>
<article>
<aside>
```

2. **ARIA labels:**
```tsx
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>
```

3. **Keyboard navigation:**
```tsx
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
```

4. **Focus management:**
```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Radix UI handles focus trapping automatically
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    {/* Focus automatically managed */}
  </DialogContent>
</Dialog>
```

### Error Handling

1. **Use error boundaries:**
```tsx
import { ChatKitErrorBoundary } from "@/components/ChatKitErrorBoundary";

<ChatKitErrorBoundary>
  <ChatInterface />
</ChatKitErrorBoundary>
```

2. **Show user-friendly errors:**
```tsx
import { Alert, AlertDescription } from "@/components/ui/alert";

{error && (
  <Alert variant="destructive">
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

3. **Loading states:**
```tsx
import { Skeleton } from "@/components/ui/skeleton";

{isLoading ? (
  <Skeleton className="h-20 w-full" />
) : (
  <DataDisplay data={data} />
)}
```

### State Management

1. **Local state with useState:**
```tsx
const [open, setOpen] = useState(false);
```

2. **Form state with React Hook Form:**
```tsx
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {}
});
```

3. **Server state with TanStack Query:**
```tsx
const { data } = useQuery({
  queryKey: ['key'],
  queryFn: fetcher
});
```

4. **Global state with Context:**
```tsx
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const { user } = useAuth();
const { theme, setTheme } = useTheme();
```

### Supabase Integration

```tsx
import { supabase } from "@/integrations/supabase/client";

// Query data
const { data, error } = await supabase
  .from('games')
  .select('*')
  .eq('status', 'active');

// Insert
const { error } = await supabase
  .from('patterns')
  .insert({ name: 'Pattern 1' });

// Update
const { error } = await supabase
  .from('games')
  .update({ status: 'completed' })
  .eq('id', gameId);

// Real-time subscriptions
const subscription = supabase
  .channel('games')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'games' },
    (payload) => console.log(payload)
  )
  .subscribe();
```

---

## Component Checklist for New Features

When building a new feature, reference this checklist:

- [ ] **Theme Support**: Works in both light and dark mode
- [ ] **Responsive**: Mobile, tablet, desktop layouts
- [ ] **Animations**: Subtle motion on interactions (hover, click)
- [ ] **Loading States**: Skeletons or spinners during data fetch
- [ ] **Error States**: User-friendly error messages
- [ ] **Empty States**: Placeholder when no data
- [ ] **Accessibility**: ARIA labels, keyboard navigation, focus management
- [ ] **TypeScript**: Full type safety with interfaces
- [ ] **Consistent Spacing**: Use Tailwind spacing scale
- [ ] **Brand Colors**: Use honeydew green for primary actions
- [ ] **Icon Library**: Use Lucide, Tabler, or Phosphor icons
- [ ] **Form Validation**: Use React Hook Form + Zod
- [ ] **Data Fetching**: Use TanStack Query for server state

---

## Common Patterns & Examples

### Game Card Pattern

```tsx
import NFLGameCard from "@/components/NFLGameCard";
import ShineBorder from "@/components/magicui/shine-border";
import Aurora from "@/components/magicui/aurora";
import { motion } from "motion/react";

<NFLGameCard
  isHovered={hovered}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
  awayTeamColors={{ primary: '#002244', secondary: '#69BE28' }}
  homeTeamColors={{ primary: '#AA0000', secondary: '#FFB81C' }}
  homeSpread={-7}
  awaySpread={7}
>
  {/* Card content */}
</NFLGameCard>
```

### Modal/Dialog Pattern

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    <div className="py-4">
      {/* Modal content */}
    </div>
  </DialogContent>
</Dialog>
```

### Notification Pattern

```tsx
import { toast } from "sonner";

// Success
toast.success("Pattern saved successfully!");

// Error
toast.error("Failed to load data");

// Loading
const loadingToast = toast.loading("Processing...");
toast.dismiss(loadingToast);
```

### Protected Route Pattern

```tsx
import { ProtectedRoute } from "@/components/ProtectedRoute";

<Route 
  path="/premium-feature" 
  element={
    <ProtectedRoute>
      <PremiumFeature />
    </ProtectedRoute>
  } 
/>
```

---

## Quick Reference: File Paths

### Core Files
- `src/App.tsx` - Main app component with routing
- `src/main.tsx` - Entry point
- `src/index.css` - Global styles & CSS variables
- `tailwind.config.ts` - Tailwind configuration
- `components.json` - Shadcn/UI configuration

### Context Providers
- `src/contexts/AuthContext.tsx` - Authentication state
- `src/contexts/ThemeContext.tsx` - Theme state (light/dark)

### Component Directories
- `src/components/ui/` - Base Shadcn components
- `src/components/magicui/` - Advanced effect components
- `src/components/animata/` - Pre-built animated components
- `src/components/landing/` - Landing page sections

### Utilities
- `src/lib/utils.ts` - `cn()` utility for class merging
- `src/integrations/supabase/` - Supabase client & types

### Pages
- `src/pages/` - All route pages

---

## Version History

- **v1.0** (Oct 2025): Initial design language documentation

---

## Questions & Updates

When in doubt:
1. Check existing similar components
2. Use Radix UI + Tailwind for consistency
3. Add animations with Motion/GSAP
4. Test in both light and dark mode
5. Ensure mobile responsiveness

For updates to this document, maintain the same structure and add version notes.

