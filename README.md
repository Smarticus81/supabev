# Beverage POS System

A sophisticated point-of-sale system for luxury beverage venues with AI-powered voice assistance and intelligent inventory management.

## Features

- 🎙️ **Voice-Controlled Interface**: Professional AI assistant "Bev" for hands-free operation
- 📊 **Real-time Inventory Management**: Track stock levels with intelligent alerts
- 🛒 **Smart Cart System**: Multi-client cart management with payment processing
- 🧠 **Learning System**: Collects interaction data for continuous improvement
- 📈 **Analytics Dashboard**: Sales insights and inventory analytics
- 💳 **Payment Processing**: Multiple payment methods with transaction tracking

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Drizzle ORM
- **Database**: PostgreSQL (Neon)
- **Voice AI**: OpenAI Realtime API, WebRTC
- **Audio Processing**: Web Audio API, Voice Activity Detection

## Learning System

The system includes a comprehensive learning apparatus for:
- **Supervised Fine-Tuning (SFT)**: Voice interaction patterns and intent recognition
- **Reinforcement Learning (RL)**: Decision optimization based on user feedback
- **Continuous Improvement**: Real-time adaptation to venue-specific needs

## Deployment

This application is configured for Railway deployment with automatic scaling and PostgreSQL integration.

## Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for voice processing
- `NODE_ENV`: Environment (production/development)

## Getting Started

1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations: `npm run db:migrate`
4. Seed the database: `npm run db:seed`
5. Start the application: `npm start`

Built for luxury hospitality venues requiring sophisticated beverage management with voice-first interaction design.
