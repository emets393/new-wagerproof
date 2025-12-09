# Polymarket Integration Documentation

Comprehensive guides for integrating and maintaining Polymarket betting widgets in WagerProof applications.

## Quick Start

**New to Polymarket integration?** Start here:

1. Read [**Main Integration Guide**](../POLYMARKET_INTEGRATION_GUIDE.md) - High-level overview and architecture
2. Follow [**Implementation Steps**](./polymarket-implementation-steps.md) - Step-by-step integration
3. Reference [**API Documentation**](./polymarket-api-reference.md) - Endpoints and payloads
4. Copy [**Code Patterns**](./polymarket-code-patterns.md) - Reusable code snippets
5. Troubleshoot with [**Troubleshooting Guide**](./polymarket-troubleshooting.md) - Common issues

## Documentation Files

### 📘 [POLYMARKET_INTEGRATION_GUIDE.md](../POLYMARKET_INTEGRATION_GUIDE.md)
**Main documentation - Start here**

- Architecture overview
- What we built (components, services, proxy)
- Key learnings (what worked, what didn't)
- Quick start guides for adding sports
- Flow diagrams and component structure

**~360 lines** | **Read Time: 10-15 minutes**

---

### 📗 [polymarket-api-reference.md](./polymarket-api-reference.md)
**Complete API documentation**

- All Polymarket endpoints (`/sports`, `/events`, `/prices-history`)
- Sample requests and responses
- Real payloads from NFL and CFB
- Available sports and identifiers
- Market type classifications
- Rate limits and best practices
- Testing commands

**~560 lines** | **Use as: Reference**

---

### 📕 [polymarket-implementation-steps.md](./polymarket-implementation-steps.md)
**Step-by-step integration guide**

**For adding new sports:**
- Discover sport metadata
- Add team mappings
- Update type definitions
- Integrate widget
- Test and deploy

**For new apps:**
- Copy required files
- Set up Supabase
- Deploy Edge Function
- Configure React Query
- Customize widget

**~730 lines** | **Follow along: 1-2 hours**

---

### 📙 [polymarket-code-patterns.md](./polymarket-code-patterns.md)
**Reusable algorithms and patterns**

**Copy-paste ready code for:**
- Team name normalization
- Market classification
- Event matching (fuzzy search)
- Price history transformation
- Widget event handling (clickability)
- Data caching
- Error handling

Each pattern includes:
- Problem description
- Complete solution code
- Usage examples
- Key logic explanations

**~760 lines** | **Use as: Code reference**

---

### 📓 [polymarket-troubleshooting.md](./polymarket-troubleshooting.md)
**Common issues and solutions**

**Covers:**
- Widget not displaying
- No data showing
- CORS errors
- Widget not clickable
- Wrong data displayed
- Performance issues
- TypeScript errors
- Deployment issues

Each issue includes:
- Symptom description
- Diagnosis steps
- Multiple solutions
- Prevention tips

**~820 lines** | **Use when: Something breaks**

---

## Related Documentation

### [POLYMARKET_CACHE_SETUP.md](../POLYMARKET_CACHE_SETUP.md)
**Database caching implementation**

- Reduce API calls
- Improve performance
- Supabase table schema
- Cron job setup
- Cache invalidation strategy

**Status**: Ready for Phase 2 (after live API validated)

---

## Documentation Stats

| File | Lines | Purpose | When to Use |
|------|-------|---------|-------------|
| **Integration Guide** | 361 | Overview & architecture | Starting out |
| **API Reference** | 563 | Endpoint documentation | Looking up APIs |
| **Implementation Steps** | 732 | How-to guides | Adding sports/apps |
| **Code Patterns** | 762 | Reusable algorithms | Writing code |
| **Troubleshooting** | 817 | Issue resolution | Something's broken |
| **TOTAL** | **3,235** | Complete reference | - |

---

## How to Use This Documentation

### Scenario 1: Adding NBA to Existing App

**Path**: Implementation Steps → Code Patterns → API Reference

1. Read [Implementation Steps - Adding a New Sport](./polymarket-implementation-steps.md#adding-a-new-sport)
2. Copy team mapping pattern from [Code Patterns](./polymarket-code-patterns.md#team-name-normalization)
3. Lookup NBA identifier in [API Reference](./polymarket-api-reference.md#available-sports)
4. Follow step-by-step guide
5. If issues: Check [Troubleshooting](./polymarket-troubleshooting.md)

---

### Scenario 2: Widget Not Working

**Path**: Troubleshooting → API Reference → Code Patterns

1. Find symptom in [Troubleshooting Guide](./polymarket-troubleshooting.md)
2. Follow diagnosis steps
3. Check console logs against expected patterns
4. If API issue: Reference [API Reference](./polymarket-api-reference.md)
5. If code issue: Check [Code Patterns](./polymarket-code-patterns.md)

---

### Scenario 3: New Developer Onboarding

**Path**: Integration Guide → Implementation Steps → Code Patterns

1. Read [Integration Guide](../POLYMARKET_INTEGRATION_GUIDE.md) for context
2. Understand architecture and data flow
3. Review [Implementation Steps](./polymarket-implementation-steps.md) for details
4. Study [Code Patterns](./polymarket-code-patterns.md) for best practices
5. Keep [API Reference](./polymarket-api-reference.md) handy
6. Bookmark [Troubleshooting](./polymarket-troubleshooting.md)

---

### Scenario 4: Integrating into Mobile App

**Path**: Implementation Steps → Integration Guide → Code Patterns

1. Follow [New App Integration](./polymarket-implementation-steps.md#integrating-into-a-new-app)
2. Review architecture in [Integration Guide](../POLYMARKET_INTEGRATION_GUIDE.md#architecture)
3. Copy patterns from [Code Patterns](./polymarket-code-patterns.md)
4. Adapt event handlers for touch
5. Test thoroughly, reference [Troubleshooting](./polymarket-troubleshooting.md)

---

## Key Concepts

### Team Name Mapping
Your app's team names → Polymarket's format
- NFL: City → Mascot ("Baltimore" → "Ravens")
- CFB: School → School ("Ohio State" → "Ohio State")
- NBA: City → Mascot ("Golden State" → "Warriors")

### Market Classification
Determining market type from question text:
- "Team A vs Team B" = Moneyline
- "Spread -7.5" = Spread
- "O/U 47.5" = Total

### CORS Proxy
Browser can't call Polymarket directly:
- Use Supabase Edge Function
- Acts as server-side proxy
- Transparent to client code

### Event Matching
Finding your game in Polymarket's events:
- Fuzzy string matching
- Multiple fallback strategies
- Logs available options if no match

---

## What We Built

### Integrated Sports
- ✅ **NFL** - 32 teams, all markets
- ✅ **College Football (CFB)** - 100+ schools, all markets

### Widget Features
- Market type selector (ML / Spread / O/U)
- Time range selector (1H / 6H / 1D / 1W / 1M / ALL)
- Interactive Recharts line chart
- Current odds display with trends
- Team color theming
- Responsive design
- Loading & error states
- Clickable without triggering parent

### Technical Components
- Service layer (`polymarketService.ts`)
- Widget component (`PolymarketWidget.tsx`)
- Type definitions (`polymarket.ts`)
- CORS proxy (Edge Function)
- Caching system (optional Phase 2)

---

## Success Criteria

**Integration is successful when:**

✅ Widget loads without errors  
✅ Data displays for active games  
✅ Chart updates with time range selection  
✅ Market types switch correctly  
✅ Widget is clickable (buttons work)  
✅ Parent card doesn't react to widget clicks  
✅ Team colors apply to chart lines  
✅ No CORS errors in console  
✅ Graceful fallback when no data  
✅ Fast load times (<2 seconds)  

---

## Maintenance

### Regular Tasks
- [ ] Monitor API changes (Polymarket updates)
- [ ] Add new teams as leagues expand
- [ ] Update mappings if team names change
- [ ] Check for deprecated endpoints
- [ ] Review error logs weekly

### When Adding New Sport
- [ ] Discover sport identifier
- [ ] Add team mappings
- [ ] Update type unions
- [ ] Test with real games
- [ ] Update this documentation

### When Issues Arise
- [ ] Check [Troubleshooting Guide](./polymarket-troubleshooting.md)
- [ ] Review console logs
- [ ] Verify Edge Function working
- [ ] Test API endpoints manually
- [ ] Update docs with new learnings

---

## Contributing

**Found an issue in docs?**
- Update the relevant file
- Keep examples realistic
- Include code snippets
- Test instructions
- Update "Last Updated" date

**Adding new sport?**
- Document in Implementation Steps
- Add to Available Sports table
- Share team mappings
- Note any quirks/gotchas

---

## Support Resources

**Internal**:
- This documentation
- Code comments in implementation
- Git history for context

**External**:
- [Polymarket Official Docs](https://docs.polymarket.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Recharts Documentation](https://recharts.org/)
- [React Query Docs](https://tanstack.com/query/latest)

---

## Version History

**v1.0** (January 2025)
- Initial documentation
- NFL integration complete
- CFB integration complete
- All 5 guides written
- 3,200+ lines of documentation

---

**Documentation Team**: WagerProof Engineering  
**Last Updated**: January 2025  
**Status**: ✅ Complete and Current

