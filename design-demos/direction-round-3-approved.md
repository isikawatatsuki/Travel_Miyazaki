# Round 3 design direction approval

- User selection: H — Bento Planner
- Required addition: retain the travel-ticket display and use it as the entry point to the selected trip
- Refined direction: H — Bento Planner + Travel Ticket
- Primary hierarchy:
  1. Active travel ticket
  2. Next scheduled action
  3. Day schedule
  4. Packing, money, and stay summaries
- Responsive behavior: the ticket stub moves below the ticket body on mobile; primary controls remain at least 44px high
- Visual feedback: the initial rounded-card treatment was judged too AI-generated
- Revised candidate: `h-humanized.html` — Japanese-first typography, square paper ticket, fine rules, asymmetric editorial layout, and reduced colour
- Ticket asset: reuse `public/travel-miyazaki-ticket-template-v5.svg` and overlay the existing `TicketCard` fields; do not draw a replacement ticket shape
- Revised candidate approval: pending
- Web-app feedback: the editorial revision did not communicate enough application structure
- Current candidate: `h-webapp.html` — persistent app shell, active navigation, breadcrumb, saved state, explicit CTAs, responsive bottom navigation, Bento dashboard, and the production ticket SVG
- Production implementation: not started
