# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` - Start Next.js development server
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run dev:full` - Run development server with voice server concurrently
- `npm run dev:premium` - Run development server with premium voice server

## Database Commands

- `npm run db:generate` - Generate Drizzle schema migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio for database management
- `npm run db:seed` - Seed database with sample data

## Voice & Learning System Commands

- `npm run voice-server` - Start the voice processing server
- `npm run premium-voice` - Start premium voice server
- `npm run mcp` - Start MCP (Model Context Protocol) server
- `npm run learning:export` - Export learning data
- `npm run learning:insights` - Generate learning insights
- `npm run learning:stats` - View learning statistics
- `npm run learning:clean` - Clean learning data
- `npm run learning:validate` - Validate learning data integrity
- `npm run learning:noise` - Analyze noise patterns
- `npm run learning:venue` - Generate venue analytics

## Performance & Latency Commands

- `npm run test:latency` - Run comprehensive latency tests
- `npm run test:inventory` - Test inventory deduction logic and real-time updates
- `npm run perf:monitor` - View current performance statistics

## Inventory Management Commands

- `npm run db:fix-inventory` - Fix inventory schema and set proper serving sizes

## Transaction Management Commands

- `npm run transactions:fix` - Fix all pending transactions and create missing transaction records

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js with Express servers for voice processing
- **Database**: PostgreSQL with Drizzle ORM
- **Voice AI**: OpenAI Realtime API, WebRTC, Voice Activity Detection
- **UI Components**: Radix UI primitives with custom styling

### Core System Components

#### Database Layer (`db/`)
- **schema.ts**: Comprehensive PostgreSQL schema with 17+ tables including drinks, orders, customers, events, inventory, staff, transactions, analytics
- **index.ts**: Database connection and query utilities
- **migrate.ts**: Migration runner
- **seed.ts**: Database seeding with sample data

#### Voice Processing System
- **VoiceAgentService** (`lib/voice-agent-service.ts`): Core service handling cart management, drink operations, inventory queries, order processing, and event bookings
- **Voice Servers** (`server/`): Express servers handling voice input/output with OpenAI integration
- **Learning System** (`lib/learning-system.js`): Collects interaction data for ML model improvement with intelligent noise filtering

#### Frontend Architecture
- **App Router Structure**: `/app` directory with API routes and page components
- **Component Library**: Custom UI components in `/components` built on Radix UI
- **State Management**: In-memory cart management for voice sessions, database-backed persistent state

#### API Routes (`app/api/`)
- `/drinks` - Drink catalog management
- `/orders` - Order processing
- `/voice-advanced` - Advanced voice processing
- `/voice/drink-management` - Voice-controlled drink operations
- `/staff` - Staff management
- `/event-packages` - Event booking management
- `/mcp/execute` - Model Context Protocol execution

### Key Data Models

#### Core Entities
- **Drinks**: Product catalog with inventory, pricing, categories, tax information
- **Orders**: Customer orders with items, totals, payment status (now properly handles pending→completed workflow)
- **Transactions**: Payment processing records with proper status tracking and automatic completion
- **Customers**: Customer profiles with loyalty and booking history  
- **Staff**: Employee management with roles, permissions, access control
- **Venues**: Event locations with capacity and amenities
- **EventBookings**: Comprehensive event management with packages
- **Inventory**: Bottle-level tracking with pour monitoring
- **Transactions**: Payment processing with multiple methods

#### Learning & Analytics
- **AuditLog**: Complete system activity tracking
- **AnalyticsData**: Business intelligence metrics
- **AiInsights**: ML-generated recommendations
- **SystemConfig**: Application settings

### Voice Integration Patterns

The system uses a sophisticated voice processing pipeline:
1. **Voice Input**: WebRTC/Web Audio API captures audio
2. **Intent Processing**: NLU system with custom intents (`data/intents.json`)
3. **Service Layer**: VoiceAgentService executes business logic
4. **Database Operations**: Real-time inventory and order management
5. **Learning Capture**: All interactions logged for model improvement

### Development Patterns

#### Database Operations
- Use Drizzle ORM with TypeScript for type-safe queries
- All prices stored in cents (integer) for precision
- Comprehensive relations defined for data integrity
- Use `sql` template literals for complex queries
- **Performance Optimized**: Neon connection caching, in-memory caching for frequently accessed data (30s TTL)
- **Parallel Operations**: Database updates run in parallel where possible
- **Inventory System**: Proper serving size calculations, bottle-level tracking, real-time deduction based on actual volume consumed

#### Voice Command Handling
- Cart operations use in-memory session storage
- Real-time inventory validation before adding items using proper serving calculations
- Fuzzy matching for drink name recognition
- Automatic inventory updates on order completion with volume-based deduction
- **Latency Optimized**: Immediate command acknowledgment, async processing, reduced response delays (500ms vs 1000ms)
- **Caching**: Drink searches cached for 30 seconds, inventory status cached
- **Inventory Accuracy**: Deducts based on actual serving sizes (1.5oz spirits, 5oz wine, 12oz beer) rather than simple quantity

#### API Design
- RESTful endpoints with consistent error handling
- TypeScript interfaces for request/response validation
- Comprehensive logging for debugging and learning
- **Performance Monitoring**: Built-in latency tracking with `@timed` decorators, automatic slow operation detection (>500ms)
- **Transaction Processing**: Proper payment workflow with pending→processing→completed status transitions

## Configuration Files

- **next.config.mjs**: Next.js configuration with build optimizations
- **drizzle.config.ts**: Database configuration for migrations
- **tailwind.config.ts**: Tailwind CSS customization
- **tsconfig.json**: TypeScript compiler configuration

## Environment Variables

Required for development:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for voice processing
- `NODE_ENV`: Environment mode

## Testing & Quality

The codebase uses intelligent noise filtering in the learning system to ensure high-quality training data. Run `npm run learning:validate` to check data integrity.

For database testing, use `npm run db:studio` to inspect data directly.

## Deployment

Configured for Railway deployment with:
- `railway.json`: Railway-specific configuration
- Automatic PostgreSQL provisioning
- Environment variable management
- Production optimizations in Next.js config