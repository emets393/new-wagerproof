# Next Steps for WagerProof Landing Page

## Immediate Actions Needed

### 1. Test the Landing Page
```bash
cd /Users/chrishabib/Documents/new-wagerproof
npm run dev
```
Then visit: `http://localhost:5173/home`

### 2. Update Additional Pages

The following route handlers need to be added to App.tsx for the complete landing experience:

```typescript
// Add these routes to the PublicLayout section in App.tsx:
<Route path="/blog" element={<Blog />} />
<Route path="/blog/:slug" element={<BlogPost />} />
<Route path="/press-kit" element={<PressKit />} />
<Route path="/privacy-policy" element={<PrivacyPolicy />} />
<Route path="/terms-of-service" element={<TermsOfService />} />
```

You'll need to copy these pages from honeydew-website:
- `honeydew-website/src/pages/Blog.tsx` → `src/pages/Blog.tsx`
- `honeydew-website/src/pages/BlogPost.tsx` → `src/pages/BlogPost.tsx`
- `honeydew-website/src/pages/PressKit.tsx` → `src/pages/PressKit.tsx`
- `honeydew-website/src/pages/PrivacyPolicy.tsx` → `src/pages/PrivacyPolicy.tsx`
- `honeydew-website/src/pages/TermsOfService.tsx` → `src/pages/PrivacyPolicy.tsx`

### 3. Change Root Route (Optional)

If you want the new landing page to be at `/` instead of `/home`, update App.tsx:

```typescript
// In the PublicLayout section, change:
const isPublicRoute = ['/welcome', '/home', '/access-denied'].includes(location.pathname);

// To:
const isPublicRoute = ['/', '/welcome', '/home', '/access-denied'].includes(location.pathname);

// And add route:
<Route path="/" element={<Landing />} />
```

Then update the authenticated section to use a different default route (like `/nfl` for logged-in users).

## Content Updates Needed

### 1. Blog Integration
- Currently uses @tryghost/content-api
- Update API configuration in `src/hooks/useBlogPosts.ts`
- Or remove blog functionality if not needed

### 2. Testimonials
- Update `src/components/landing/Testimonials.tsx`
- Replace placeholder testimonials with real WagerProof user feedback

### 3. BentoGrid Features
- Update `src/components/landing/BentoGrid.tsx`
- Add sports betting specific features and screenshots

### 4. Press Kit
- Add WagerProof logos, brand assets
- Update company information
- Add media contact details

### 5. Privacy Policy & Terms
- Review and update legal language
- Ensure compliance with betting/gambling regulations
- Update contact information

## Styling & Branding

### Color Scheme Update (When Ready)
The current theme uses "honeydew" green colors. To update:

1. Update `tailwind.config.ts` honeydew color variables
2. Or find/replace "honeydew" color classes with new brand colors
3. Update color references in CSS files

### Custom Animations
- The landing page uses advanced animations (GSAP, Lenis, Light Rays)
- Review performance on lower-end devices
- Consider disabling heavy animations on mobile

## Performance Optimization

### 1. Image Optimization
- Replace video in Hero section with WagerProof demo video
- Optimize all images with proper formats (WebP)
- Add lazy loading for below-fold images

### 2. Code Splitting
- Consider lazy loading landing page components
- Split out heavy animation libraries

### 3. SEO Improvements
- Add sitemap.xml
- Add robots.txt
- Set up Google Analytics or preferred analytics
- Update Rybbit analytics configuration

## Deployment Checklist

Before deploying:
- [ ] Test all routes and links
- [ ] Test on mobile devices
- [ ] Test in different browsers
- [ ] Verify all CTAs link correctly
- [ ] Check console for errors
- [ ] Verify meta tags in production
- [ ] Test social media sharing (OG images)
- [ ] Add Google Analytics/Tracking
- [ ] Set up monitoring/error tracking
- [ ] Configure CDN for assets
- [ ] Set up SSL certificate
- [ ] Configure caching headers

## Marketing Setup

### Social Media Integration
- Verify TikTok link: https://www.tiktok.com/@wagerproof
- Verify Twitter handle: @wagerproof
- Verify Instagram: @wagerproof
- Add social media meta tags verification

### Email Capture
- Consider adding email signup form
- Newsletter integration
- Lead magnet (free picks, guide, etc.)

### A/B Testing
- Test different headlines
- Test CTA button text
- Test pricing presentation
- Track conversion rates

## Technical Debt

### Clean Up
- Remove unused honeydew-website folder after verification
- Remove old Landing.tsx (now replaced by NewLanding.tsx)
- Clean up any duplicate components

### Documentation
- Document new component structure
- Add JSDoc comments to key components
- Create style guide for future updates

## Support & Legal

### Required Pages
- [ ] Contact page
- [ ] FAQ page
- [ ] Responsible gambling resources
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie Policy (if applicable)

### Compliance
- Review gambling advertising regulations
- Add age verification if required
- Add disclaimers about betting risks
- Check state-by-state requirements

## Quick Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Install dependencies
npm install

# Update dependencies
npm update
```

## Questions to Answer

1. Should the root `/` route show the landing page or redirect to dashboard?
2. Do you need the blog functionality?
3. What analytics platform do you want to use?
4. Do you need email capture/newsletter signup?
5. What's the priority for content updates?
6. When can we get real screenshots/demo videos?
7. Do you need A/B testing capabilities?
8. What's the go-live timeline?

