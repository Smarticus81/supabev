# Beverage POS System

A modern, voice-controlled beverage point-of-sale system with real-time updates and premium WebSocket communication.

## 🚀 Quick Start

### Option 1: One-Button Startup (Recommended)
```bash
npm run start-all
```

### Option 2: Windows Batch File
Double-click `start-servers.bat`

### Option 3: PowerShell Script
Right-click `start-servers.ps1` → "Run with PowerShell"

### Option 4: Manual Startup
```bash
# Terminal 1: Start WebSocket Server
npm run start-ws

# Terminal 2: Start Next.js App
npm run dev
```

## 🌐 Access Points
- **WebSocket Server**: http://localhost:8081
- **Next.js App**: http://localhost:3000

## 🎤 Voice Control
- Wake word: "Hey Bev" (or variations like "Hey Beth", "Bev", etc.)
- Voice commands for adding drinks, managing cart, and more

## 🛠️ Development
- Built with Next.js 14
- Real-time WebSocket communication
- OpenAI WebRTC Voice API integration
- Tailwind CSS for styling

## 📁 Project Structure
- `/app` - Next.js app router pages and API routes
- `/components` - React components including voice control
- `/scripts` - Server scripts (WebSocket, MCP, etc.)
- `/data` - JSON data files for drinks and configurations
