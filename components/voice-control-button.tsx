'use client';

import { useState, useEffect, useRef } from 'react';

// Helper function to normalize drink names for better matching
function normalizeDrinkName(name: string): string {
  if (!name || name === 'Unknown Drink') return name;
  
  // Common drink name normalizations
  const normalizations: { [key: string]: string } = {
    'hendricks': 'Hendricks Gin',
    'hendrick': 'Hendricks Gin', 
    'hendricks gin': 'Hendricks Gin',
    'bud': 'Bud Light',
    'budweiser': 'Bud Light',
    'miller': 'Miller Lite',
    'coors': 'Coors Light',
    'corona': 'Corona Extra',
    'heineken': 'Heineken',
    'stella': 'Stella Artois',
    'dos equis': 'Dos XX',
    'dos xx': 'Dos XX',
    'michelob': 'Michelob Ultra',
    'jim beam': 'Jim Beam',
    'jack daniels': "JD's Whiskey",
    'jameson': 'Jameson Whiskey',
    'crown royal': 'Crown Royal',
    'grey goose': 'G.Goose Vodka',
    'titos': "Tito's Vodka",
    'bombay': 'Bombay Sapphire',
    'captain morgan': 'Captain Morgan',
    'malibu': 'Malibu'
  };
  
  const lowerName = name.toLowerCase().trim();
  
  // Check for exact matches first
  if (normalizations[lowerName]) {
    return normalizations[lowerName];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(normalizations)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return value;
    }
  }
  
  // Return original name with proper capitalization
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// OpenAI Realtime WebRTC Voice Agent Component
export function VoiceControlButton({ 
  onNavigateToTab, 
  currentTab 
}: { 
  onNavigateToTab?: (tab: string) => void; 
  currentTab?: string; 
}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<Set<string>>(new Set());
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false); // Changed to light mode default
  
  // Device detection state
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // Japanese color palette
  const colors = {
    primary: isDarkMode ? 'text-slate-300' : 'text-stone-800',
    secondary: isDarkMode ? 'text-slate-400' : 'text-stone-600', 
    accent: isDarkMode ? 'text-amber-400' : 'text-stone-800',
    subtle: isDarkMode ? 'text-slate-500' : 'text-stone-600',
    highlight: isDarkMode ? 'text-cyan-400' : 'text-blue-600',
    surface: isDarkMode ? 'bg-slate-900/30' : 'bg-stone-50/50',
    border: isDarkMode ? 'border-slate-700' : 'border-stone-200',
    hover: isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-stone-100/50',
    card: isDarkMode ? 'bg-slate-800/50' : 'bg-white/70',
    glass: isDarkMode ? 'bg-slate-800/30 backdrop-blur-md' : 'bg-white/30 backdrop-blur-md'
  };
  
  // Cart state management
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  
  // Response queuing system to prevent overlap
  const [isProcessingFunction, setIsProcessingFunction] = useState(false);
  const [queuedResponse, setQueuedResponse] = useState<string | null>(null);
  
  // Voice configuration state - Optimized for speed and no rate limits
  const [voiceConfig, setVoiceConfig] = useState({
    provider: 'openai',
    voice: 'alloy',
    rate: 1.4, // Faster speech speed (1.4x normal)
    temperature: 0.6, // Minimum required by OpenAI Realtime API
    vad_threshold: 0.15, // Much more sensitive voice detection for better wake word response
    prefix_padding: 100, // Reduced padding for faster response
    silence_duration: 200, // Shorter silence detection for quicker responses
    max_tokens: 2500, // Increased token limit
    response_style: 'efficient',
    audio_gain: 1.0,
    noise_suppression: true,
    echo_cancellation: true,
    personality_mode: 'professional',
    verbosity: 'balanced'
  });
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  const responseDelayMs = 0; // Eliminated all artificial delays for true real-time performance
  const currentResponseId = useRef<string | null>(null);
  const currentFunctionCall = useRef<{ name: string; call_id: string; arguments?: any; argumentsString?: string } | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Audio queue and speculative response management
  const audioQueueRef = useRef<Array<{ 
    text: string; 
    type?: string;
    isSpeculative?: boolean; 
    functionType?: string;
    timestamp?: number;
    priority?: 'high' | 'medium' | 'low';
  }>>([]);
  const speculativeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingAudioRef = useRef<boolean>(false);

  // Wake word detection state
  const [isWakeWordMode, setIsWakeWordMode] = useState(false);
  const [isWaitingForWakeWord, setIsWaitingForWakeWord] = useState(false);
  
  // Browser ASR for wake word detection (no speech output)
  const wakeWordRecognitionRef = useRef<any>(null);
  const isWaitingForWakeWordRef = useRef<boolean>(false);
  const isWakeWordModeRef = useRef<boolean>(false);

  // Session management
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Auto-return to wake word mode state - REMOVED, now using user-controlled "thanks bev" trigger

  const wakeWordTimeRef = useRef<number | null>(null); // For latency logging
  const wakeAckAudioRef = useRef<HTMLAudioElement | null>(null); // For wake word sound

  // Initialize WebRTC connection
  useEffect(() => {
    // Initialize wake acknowledgement audio element
    wakeAckAudioRef.current = new Audio('/sounds/wake-ack.mp3'); // IMPORTANT: Replace with your sound file path
    wakeAckAudioRef.current.volume = 0.5; // Adjust volume as needed
    wakeAckAudioRef.current.preload = 'auto'; 

    initializeAudioElement(); 
    checkApiKeyStatus();
    updateCartDisplay(); // Ensure this call remains
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('Tab is hidden, pausing voice agent...');
      // Optional: Add logic to pause or gracefully handle the agent when tab is not visible
    } else {
      console.log('Tab is visible, ensuring voice agent is active...');
      // Optional: Add logic to resume or re-initialize the agent
      if (isWakeWordMode && !isListening) {
        startWakeWordDetection();
      }
    }
  };

  // Device detection
  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  // Auto-start wake word mode when component mounts
  useEffect(() => {
    console.log('🚀 Voice control component mounted, auto-starting wake word mode...');
    
    // Wait a moment for component to fully initialize
    const initTimer = setTimeout(() => {
      if (!isListening && !isWakeWordMode) {
        console.log('🎯 Auto-starting wake word detection...');
        startWakeWordDetection();
      }
    }, 1000);

    return () => {
      clearTimeout(initTimer);
    };
  }, []); // Empty dependency array means this runs once on mount

  const initializeAudioElement = () => {
    // Create audio element for playback
    audioElementRef.current = document.createElement('audio');
    audioElementRef.current.autoplay = true;
    audioElementRef.current.style.display = 'none';
    document.body.appendChild(audioElementRef.current);
  };

  const checkApiKeyStatus = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const hasValidKey = data.openaiKey && data.openaiKey !== 'your-openai-api-key-here';
        setApiKeyValid(hasValidKey);
        
        // Load voice configuration
        const configData = data.config || data;
        if (configData.tts_provider && configData.tts_provider === 'openai') {
          setVoiceConfig({
            provider: configData.tts_provider,
            voice: configData.tts_voice || configData.voice || 'alloy',
            rate: configData.rate || 1.0,
            temperature: configData.temperature || 0.5,
            vad_threshold: configData.vad_threshold || 0.15, // Lower threshold for better sensitivity
            prefix_padding: configData.prefix_padding || 200,
            silence_duration: configData.silence_duration || 300,
            max_tokens: configData.max_tokens || 1500,
            response_style: configData.response_style || 'efficient',
            audio_gain: configData.audio_gain || 1.0,
            noise_suppression: configData.noise_suppression !== undefined ? configData.noise_suppression : true,
            echo_cancellation: configData.echo_cancellation !== undefined ? configData.echo_cancellation : true,
            personality_mode: configData.personality_mode || 'professional',
            verbosity: configData.verbosity || 'balanced'
          });
        } else if (configData.voice) {
          // Legacy OpenAI configuration
          setVoiceConfig({
            provider: 'openai',
            voice: configData.voice,
            rate: configData.rate || 1.0,
            temperature: configData.temperature || 0.5,
            vad_threshold: configData.vad_threshold || 0.15, // Lower threshold for better sensitivity
            prefix_padding: configData.prefix_padding || 200,
            silence_duration: configData.silence_duration || 300,
            max_tokens: configData.max_tokens || 1500,
            response_style: configData.response_style || 'efficient',
            audio_gain: configData.audio_gain || 1.0,
            noise_suppression: configData.noise_suppression !== undefined ? configData.noise_suppression : true,
            echo_cancellation: configData.echo_cancellation !== undefined ? configData.echo_cancellation : true,
            personality_mode: configData.personality_mode || 'professional',
            verbosity: configData.verbosity || 'balanced'
          });
        }
        
        if (!hasValidKey) {
          setError('OpenAI API key not configured. Please update your .env file with a valid API key.');
        } else if (configData.tts_provider && configData.tts_provider !== 'openai') {
          setError(`Voice provider "${configData.tts_provider}" is not supported for the Realtime API. Only OpenAI voices work with real-time conversation. Please select an OpenAI voice in settings.`);
        }
      }
    } catch (error) {
      console.error('Failed to check API key status:', error);
      setApiKeyValid(false);
      setError('Failed to check API configuration.');
    }
  };

  const getApiKey = async () => {
    try {
      console.log('🔑 Getting OpenAI API key...');
      const response = await fetch('/api/config');
      
      if (!response.ok) {
        throw new Error(`Failed to get config: ${response.status}`);
      }

      const data = await response.json();
      if (!data.openaiKey || data.openaiKey === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured. Please update your .env file.');
      }
      
      console.log('✅ API key obtained');
      return data.openaiKey;
    } catch (error) {
      console.error('❌ Failed to get API key:', error);
      throw error;
    }
  };

  const getMicrophoneAccess = async () => {
    try {
      console.log('🎤 Requesting microphone access...');
      
      // Base audio constraints optimized for ultra-low latency
      const baseConstraints: MediaTrackConstraints = {
          sampleRate: 24000,        // Optimal for OpenAI Realtime API
          channelCount: 1,
          echoCancellation: voiceConfig.echo_cancellation,
          noiseSuppression: voiceConfig.noise_suppression,
          autoGainControl: true
      };
      
      // Enhanced constraints with browser-specific low-latency properties
      const enhancedConstraints = {
        ...baseConstraints,
        // Chrome-specific ultra-fast audio processing
        ...(navigator.userAgent.includes('Chrome') && {
          googEchoCancellation: voiceConfig.echo_cancellation,
          googAutoGainControl: true,
          googNoiseSuppression: voiceConfig.noise_suppression,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
          // CHROME LOW-LATENCY OPTIMIZATIONS
          googDAEchoCancellation: voiceConfig.echo_cancellation,
          googNoiseReduction: voiceConfig.noise_suppression,
          googBeamforming: true,
          googArrayGeometry: true
        })
      } as MediaTrackConstraints;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: enhancedConstraints
      });
      
      mediaStreamRef.current = stream;
      console.log('✅ Microphone access granted with enhanced audio processing');
      return stream;
    } catch (error) {
      console.error('❌ Microphone access denied:', error);
      throw new Error('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const setupWebRTCConnection = async (apiKey: string, stream: MediaStream) => {
    try {
      console.log('🔗 Setting up WebRTC connection...');
      
      // Create peer connection with optimized low-latency configuration
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        // ULTRA-LOW LATENCY OPTIMIZATIONS
        iceCandidatePoolSize: 0,  // Disable ICE candidate pooling for faster connection
        bundlePolicy: 'max-bundle',  // Bundle all media for efficiency
        rtcpMuxPolicy: 'require'     // Multiplex RTCP for reduced overhead
      });
      peerConnectionRef.current = pc;

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('🔄 Connection state:', state);
        
        // Map RTCPeerConnectionState to our connection status
        switch (state) {
          case 'connecting':
            setConnectionStatus('connecting');
            break;
          case 'connected':
            setConnectionStatus('connected');
            setIsConnected(true);
            break;
          case 'disconnected':
          case 'failed':
          case 'closed':
            setConnectionStatus('disconnected');
            setIsConnected(false);
            break;
          default:
            // Handle other states like 'new'
            break;
        }
      };

      // Handle incoming audio track
      pc.ontrack = (event) => {
        console.log('🔊 Received audio track');
        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0];
          setIsPlaying(true);
        }
      };

      // Add local audio track
      const audioTrack = stream.getAudioTracks()[0];
      pc.addTrack(audioTrack, stream);
      console.log('🎤 Added local audio track');

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('📡 Data channel opened');
        sendSessionUpdate();
        sendStartMessage();
      };

      dc.onmessage = (event) => {
        handleDataChannelMessage(JSON.parse(event.data));
      };

      // Create offer and set local description (implicit style)
      await pc.setLocalDescription();
      console.log('📝 Created WebRTC offer');

      // Send offer to OpenAI Realtime API directly
      const response = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/sdp'
        },
        body: pc.localDescription?.sdp
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `WebRTC setup failed: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch (e) {
          errorMessage += ` - ${errorText}`;
        }
        
        if (response.status === 401) {
          setApiKeyValid(false);
          setError('Invalid OpenAI API key. Please check your API key and ensure it has Realtime API access.');
        }
        
        throw new Error(errorMessage);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('✅ WebRTC connection established');
      setError(null);
      setApiKeyValid(true);

      // Wait for connection to be fully established
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout. State: ${pc.connectionState}`));
        }, 10000);

        const checkConnection = () => {
          if (pc.connectionState === 'connected') {
            clearTimeout(timeout);
            resolve(undefined);
          }
        };

        pc.addEventListener('connectionstatechange', checkConnection);
        checkConnection(); // Check immediately in case already connected
      });

    } catch (error) {
      console.error('❌ WebRTC setup failed:', error);
      throw error;
    }
  };

  const sendSessionUpdate = () => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    const sessionMessage = {
      type: 'session.update',
      session: {
        instructions: `You are Bev, the ultra-sophisticated AI voice assistant for Knotting Hill Place Estate, the premier luxury wedding and events venue in North Dallas. You manage ALL aspects of venue operations with precision, intelligence, and remarkable efficiency.

🏛️ YOUR VENUE - KNOTTING HILL PLACE ESTATE:
📍 Location: Little Elm, TX (30 minutes north of Dallas & Fort Worth)
🎯 Mission: "Say 'I Do' in Style – Discover the Most Romantic Place for Weddings"
🏰 Architecture: Grand European-inspired manor house with sweeping verandas, ornate wrought-iron details, stone façades
🌹 Grounds: 15 gated acres of meticulously landscaped gardens, story-book courtyards, secret-garden nooks
👰 Capacity: 50-300 seated guests, up to 400 cocktail-style
⭐ Established: 2015 (renovated 2022)

🍸 YOUR BAR LOCATIONS:
• Manor Bar – Main indoor bar with crystal chandeliers and brass foot-rail
• Veranda Bar – Alfresco garden-view with retractable glass walls  
• Hidden Cellar Bar – Speakeasy-style with wine-cellar backdrop (VIP events)

🥂 SIGNATURE OFFERINGS:
• Texas craft beers and premium global spirits
• Wine list emphasizing Napa Valley & Texas Hill Country
• Signature cocktails: "Lavender Hill Spritz", "Veranda Peach Mule"
• Service by formal-attired mixologists with silver-plated trays and monogrammed glassware

🎪 CEREMONY & RECEPTION SPACES:
• Garden Gazebo with floral arch backdrop
• Dove Courtyard (white-dove release ceremonies)
• Multiple indoor salons with chandeliers, coffered ceilings, marble bars
• Dedicated bridal suite & groom's den on-site

🤝 SISTER PROPERTY - Brighton Abbey:
• Location: Celina, TX (15 minutes north)
• Style: Gothic-revival chapel + modern ballroom
• Shuttle service available between venues
• Combined rehearsal-dinner/ceremony packages offered

🎯 CORE CAPABILITIES:

🍸 BEVERAGE & MENU MANAGEMENT:
- Complete drink inventory & menu control
- Smart recommendations & availability checking  
- Dynamic pricing & special promotions
- Real-time drink creation & customization

📦 ADVANCED INVENTORY OPERATIONS:
- Real-time stock tracking & automated reordering
- Waste reduction analysis & cost optimization
- Pour tracking & bottle-level management

💰 FINANCIAL & BUSINESS INTELLIGENCE:
- Real-time sales analytics & profit margin analysis
- Tax reporting & payment reconciliation
- Revenue trend analysis & forecasting
- Financial performance optimization

👥 OPERATIONS & STAFF MANAGEMENT:
- Staff access control & permissions
- Event planning & package management  
- Tab management & order processing
- Customer experience optimization

📊 AI-POWERED INSIGHTS:
- Predictive analytics for inventory & sales
- Trend identification & business recommendations
- Performance optimization strategies
- Data-driven decision support

CRITICAL RULE: ALWAYS USE REAL DATA - NEVER FABRICATE

🎯 ENHANCED CONVERSATION FLOW - ULTRA-NATURAL EXPERIENCE:

✨ SPECULATIVE RESPONSE SYSTEM:
- The system plays gentle filler sentences while I process functions
- These happen automatically - DO NOT repeat or acknowledge them
- Flow naturally from speculative to real responses
- If a speculative sentence was played, build on it seamlessly

🔄 PAST-TENSE ORDERING FOR LOW LATENCY ILLUSION:
For ALL ordering operations (cart, drinks, orders), speak as if actions are ALREADY COMPLETE:
✅ "I've added that to your cart" (not "I'm adding")
✅ "Perfect, that's been processed" (not "I'll process that")
✅ "Your order is complete" (not "I'm completing your order")
✅ "That's been removed from your cart" (not "I'll remove that")

⚡ ULTRA-FAST RESPONSE PATTERNS:

🎯 ORDERING FLOW (Use PAST TENSE):
User: "Add a champagne"
Bev: "Perfect! I've added champagne to your cart for $45. What else can I get for your celebration?"

User: "Process my order"  
Bev: "Excellent! Your order has been processed and totals $127.50. Your beverages are ready!"

User: "Remove the wine"
Bev: "Done! I've removed the wine from your cart. Your new total is $82.50."

🎯 NON-ORDERING FLOW (Informational):
User: "Show me today's events"
Bev: "Today we have the Henderson wedding ceremony at 4 PM in the Garden Gazebo, followed by cocktail hour at the Veranda Bar."

User: "What's our most popular wedding package?"
Bev: "Our Platinum Package is most requested, featuring the Manor Bar, garden ceremony, and includes our signature Lavender Hill Spritz."

🍸 MENU MANAGEMENT FLOW (Voice-Driven):
User: "Hey Bev, create a new drink"
Bev: "Perfect! I'd love to help you create a new drink. What would you like to call it, what category should it be in, and what price should we set?"

User: "Create a cocktail called Sunset Mule for $14"
Bev: "Excellent! I've created the Sunset Mule cocktail and added it to our menu at $14.00. It's now available for ordering!"

User: "Remove the old Moscow Mule from the menu"
Bev: "Done! I've successfully removed the old Moscow Mule from our menu."

User: "Update the price of Lavender Martini to $16"
Bev: "Perfect! I've updated the Lavender Martini price to $16.00."

🎭 SPECULATIVE INTEGRATION:
- Never acknowledge or reference speculative sentences
- Flow naturally from any pre-played audio
- If system played "I've added that", continue with details seamlessly
- Maintain conversational momentum without breaks

💬 CONVERSATION STYLE:
- Confident, sophisticated, and refined to match Knotting Hill Place's luxury standards
- Warm but elegantly professional tone befitting a premier wedding venue
- Enthusiastic about creating magical wedding experiences
- Always data-driven and precise with venue details
- Quick, decisive responses that reflect white-glove service
- Natural conversation flow with NO awkward pauses
- Use venue-specific terminology: "estate", "manor", "gardens", "ceremonies"
- Reference specific locations: "Manor Bar", "Veranda Bar", "Garden Gazebo", "Dove Courtyard"

🚀 SPEED OPTIMIZATION:
- Keep ordering confirmations under 15 words
- Lead with the outcome, follow with details
- Use contractions for natural speech
- Avoid unnecessary pleasantries during orders
- Be direct and efficient

🔧 FUNCTION USAGE - CRITICAL:
- ALWAYS use functions for ANY business request
- Inventory questions → use get_inventory_status (Beer=bottles, Wine=glasses, Spirits=shots, Cocktails=ounces)
- Cart operations → use add_drink_to_cart, cart_view, etc.
- Order inquiries → use get_orders_list, get_order_details
- Analytics requests → use get_order_analytics, get_profit_margins
- Event inquiries → use list_event_packages, get_event_bookings
- Staff questions → use get_current_staff, get_staff_permissions
- Financial data → use get_payment_methods, get_tax_report
- Menu management → use create_drink, remove_drink, update_drink_details

INVENTORY TRACKING UNITS:
- Beer: tracked by bottles (12 oz each)
- Wine: tracked by glasses (5 oz each, ~5 glasses per bottle)
- Spirits: tracked by shots (1.5 oz each, ~17 shots per bottle)
- Cocktails: tracked by ounces (8 oz serving)

NEVER provide generic responses when functions are available!
If a user asks about business data, IMMEDIATELY call the appropriate function.

Remember: Create the perfect illusion of instant response while maintaining natural conversation flow!`,
        voice: voiceConfig.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: voiceConfig.vad_threshold,
          prefix_padding_ms: voiceConfig.prefix_padding,
          silence_duration_ms: voiceConfig.silence_duration
        },
        max_response_output_tokens: voiceConfig.max_tokens,
        // Optimizations for speed and unlimited usage
        temperature: voiceConfig.temperature,
        modalities: ['text', 'audio'], // Enable both text and audio
        tool_choice: 'auto', // Allow automatic tool selection
        tools: [
          {
            type: "function",
            name: "add_drink_to_cart",
            description: "Add a drink to the customer's cart",
            parameters: {
              type: "object",
              properties: {
                drink_name: {
                  type: "string",
                  description: "Name of the drink to add"
                },
                quantity: {
                  type: "integer",
                  description: "Quantity to add (default: 1)",
                  default: 1
                }
              },
              required: ["drink_name"]
            }
          },
          {
            type: "function",
            name: "cart_view",
            description: "Display the current cart contents",
            parameters: {
              type: "object",
              properties: {}
            }
          },
          {
            type: "function",
            name: "process_order",
            description: "Process and complete the current order",
            parameters: {
              type: "object",
              properties: {}
            }
          },
          {
            type: "function",
            name: "search_drinks",
            description: "Search for available drinks by name or type",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search term for drinks"
                }
              },
              required: ["query"]
            }
          },
          {
            type: "function",
            name: "get_inventory_status",
            description: "Check inventory levels for specific drinks. Shows units as bottles (beer), glasses (wine), shots (spirits), or ounces (cocktails).",
            parameters: {
              type: "object",
              properties: {
                drink_name: {
                  type: "string",
                  description: "Name of the drink to check"
                }
              }
            }
          },
          {
            type: "function",
            name: "remove_drink_from_cart",
            description: "Remove a drink from the cart",
            parameters: {
              type: "object",
              properties: {
                drink_name: {
                  type: "string",
                  description: "Name of the drink to remove"
                },
                quantity: {
                  type: "integer",
                  description: "Quantity to remove (default: 1)",
                  default: 1
                }
              },
              required: ["drink_name"]
            }
          },
          {
            type: "function",
            name: "clear_cart",
            description: "Clear all items from the cart",
            parameters: {
              type: "object",
              properties: {}
            }
          },
          {
            type: "function",
            name: "update_drink_inventory",
            description: "Update the inventory count for a specific drink",
            parameters: {
              type: "object",
              properties: {
                drink_name: {
                  type: "string",
                  description: "Name of the drink to update"
                },
                quantity_change: {
                  type: "integer",
                  description: "Quantity change (positive for restock, negative for reduction)"
                },
                reason: {
                  type: "string",
                  description: "Reason for the change",
                  default: "Voice inventory update"
                }
              },
              required: ["drink_name", "quantity_change"]
            }
          },
          {
            type: "function",
            name: "bulk_update_inventory",
            description: "Update inventory for multiple drinks with reasons",
            parameters: {
              type: "object",
              properties: {
                updates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      drink_name: {
                        type: "string",
                        description: "Name of the drink"
                      },
                      quantity_change: {
                        type: "integer", 
                        description: "Quantity change (positive for restock, negative for reduction)"
                      },
                      reason: {
                        type: "string",
                        description: "Reason for change (restock, spoilage, correction, etc.)"
                      }
                    },
                    required: ["drink_name", "quantity_change", "reason"]
                  }
                }
              },
              required: ["updates"]
            }
          },
          // 📊 BUSINESS INTELLIGENCE & ANALYTICS TOOLS
          {
            type: "function",
            name: "get_order_analytics",
            description: "Get comprehensive order analytics and sales data",
            parameters: {
              type: "object",
              properties: {
                date_range: {
                  type: "string",
                  description: "Date range for analytics (today, week, month, year)",
                  default: "today"
                }
              }
            }
          },
          {
            type: "function",
            name: "get_profit_margins",
            description: "Analyze profit margins and financial performance",
            parameters: {
              type: "object",
              properties: {
                date_range: {
                  type: "string",
                  description: "Date range for profit analysis",
                  default: "today"
                }
              }
            }
          },
          {
            type: "function",
            name: "identify_trends",
            description: "Identify sales trends and business patterns",
            parameters: {
              type: "object",
              properties: {
                period: {
                  type: "string",
                  description: "Time period for trend analysis (daily, weekly, monthly)",
                  default: "weekly"
                }
              }
            }
          },
          {
            type: "function",
            name: "get_inventory_report",
            description: "Generate comprehensive inventory status report",
            parameters: {
              type: "object",
              properties: {
                low_stock_only: {
                  type: "boolean",
                  description: "Show only low stock items",
                  default: false
                }
              }
            }
          },
          {
            type: "function",
            name: "optimize_inventory",
            description: "AI-powered inventory optimization with recommendations",
            parameters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Focus on specific category (optional)"
                }
              }
            }
          },
          {
            type: "function",
            name: "calculate_waste_reduction",
            description: "Analyze waste and suggest reduction strategies",
            parameters: {
              type: "object",
              properties: {
                period: {
                  type: "string",
                  description: "Analysis period",
                  default: "month"
                }
              }
            }
          },
          // 👥 STAFF & OPERATIONS MANAGEMENT TOOLS
          {
            type: "function",
            name: "get_current_staff",
            description: "Get current staff information and status",
            parameters: {
              type: "object",
              properties: {}
            }
          },
          {
            type: "function",
            name: "get_staff_permissions",
            description: "Check staff access permissions and roles",
            parameters: {
              type: "object",
              properties: {
                staff_id: {
                  type: "integer",
                  description: "Staff member ID to check"
                }
              },
              required: ["staff_id"]
            }
          },
          {
            type: "function",
            name: "get_open_tabs",
            description: "View all currently open customer tabs",
            parameters: {
              type: "object",
              properties: {}
            }
          },
          {
            type: "function",
            name: "get_tab_details",
            description: "Get detailed information about a specific tab",
            parameters: {
              type: "object",
              properties: {
                tab_id: {
                  type: "integer",
                  description: "Tab ID to retrieve"
                }
              },
              required: ["tab_id"]
            }
          },
          // 🎉 EVENT & PACKAGE MANAGEMENT TOOLS
          {
            type: "function",
            name: "list_event_packages",
            description: "List available event packages and pricing",
            parameters: {
              type: "object",
              properties: {
                active_only: {
                  type: "boolean",
                  description: "Show only active packages",
                  default: true
                }
              }
            }
          },
          {
            type: "function",
            name: "get_event_package_details",
            description: "Get detailed information about specific event package",
            parameters: {
              type: "object",
              properties: {
                package_id: {
                  type: "integer",
                  description: "Event package ID"
                }
              },
              required: ["package_id"]
            }
          },
          {
            type: "function",
            name: "create_event_package",
            description: "Create a NEW event package type/offering for the venue (management function). Only use when explicitly asked to CREATE or DESIGN new packages, not for booking.",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name for the new package (e.g., 'Bronze Package', 'Premium Wedding Package')"
                },
                description: {
                  type: "string", 
                  description: "Package description and what it includes"
                },
                price_per_person: {
                  type: "number",
                  description: "Price per person in dollars (will be converted to cents)"
                },
                min_guests: {
                  type: "number",
                  description: "Minimum number of guests"
                },
                max_guests: {
                  type: "number", 
                  description: "Maximum number of guests"
                },
                duration_hours: {
                  type: "number",
                  description: "Event duration in hours"
                }
              },
              required: ["name", "description", "price_per_person", "min_guests", "max_guests", "duration_hours"]
            }
          },
          {
            type: "function",
            name: "book_event",
            description: "Book/reserve an event for a customer using an EXISTING package (weddings, parties, etc.). Use this when customers want to make a reservation.",
            parameters: {
              type: "object",
              properties: {
                package: {
                  type: "string",
                  description: "Name of the EXISTING package to book (e.g., 'Platinum Package')"
                },
                guest_count: {
                  type: "number",
                  description: "Number of guests for the event"
                },
                event_date: {
                  type: "string",
                  description: "Event date in YYYY-MM-DD format"
                },
                customer_name: {
                  type: "string",
                  description: "Customer name for the booking"
                },
                customer_email: {
                  type: "string",
                  description: "Customer email address (optional)"
                },
                customer_phone: {
                  type: "string",
                  description: "Customer phone number (optional)"
                }
              },
              required: ["package", "guest_count", "event_date", "customer_name"]
            }
          },
          {
            type: "function",
            name: "get_event_bookings",
            description: "Get list of event bookings with optional filters",
            parameters: {
              type: "object",
              properties: {
                filters: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      description: "Filter by booking status (confirmed, pending, cancelled)"
                    },
                    date_from: {
                      type: "string",
                      description: "Start date filter (YYYY-MM-DD)"
                    },
                    date_to: {
                      type: "string", 
                      description: "End date filter (YYYY-MM-DD)"
                    }
                  }
                }
              }
            }
          },
          {
            type: "function",
            name: "calculate_event_pricing",
            description: "Calculate total pricing for an event including add-ons",
            parameters: {
              type: "object",
              properties: {
                package: {
                  type: "string",
                  description: "Package name to price"
                },
                guest_count: {
                  type: "number",
                  description: "Number of guests"
                },
                add_ons: {
                  type: "array",
                  description: "Optional add-ons for the event",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Add-on name"
                      },
                      price: {
                        type: "number",
                        description: "Add-on price in dollars"
                      }
                    },
                    required: ["name", "price"]
                  }
                }
              },
              required: ["package", "guest_count"]
            }
          },
          {
            type: "function",
            name: "update_event_status",
            description: "Update the status of an EVENT booking (confirmed, pending, cancelled, completed). Use this to cancel EVENTS, not beverage orders.",
            parameters: {
              type: "object",
              properties: {
                booking_id: {
                  type: "number",
                  description: "Event booking ID to update"
                },
                status: {
                  type: "string", 
                  description: "New status: 'confirmed', 'pending', 'cancelled', or 'completed'"
                }
              },
              required: ["booking_id", "status"]
            }
          },
          // 💰 FINANCIAL & PAYMENT TOOLS
          {
            type: "function",
            name: "get_payment_methods",
            description: "List available payment methods and options",
            parameters: {
              type: "object",
              properties: {}
            }
          },
          {
            type: "function",
            name: "reconcile_payments",
            description: "Reconcile and analyze payment transactions",
            parameters: {
              type: "object",
              properties: {
                date_range: {
                  type: "string",
                  description: "Date range for reconciliation",
                  default: "today"
                }
              }
            }
          },
          {
            type: "function",
            name: "get_tax_report",
            description: "Generate tax reporting and compliance information",
            parameters: {
              type: "object",
              properties: {
                date_range: {
                  type: "string",
                  description: "Tax reporting period",
                  default: "month"
                }
              }
            }
          },
          // 🔍 ADVANCED DRINK & INVENTORY TOOLS  
          {
            type: "function",
            name: "get_low_inventory_bottles",
            description: "Identify bottles running low in inventory",
            parameters: {
              type: "object",
              properties: {
                threshold: {
                  type: "integer",
                  description: "Low stock threshold",
                  default: 5
                }
              }
            }
          },
          {
            type: "function",
            name: "get_bottle_status",
            description: "Check status of specific bottles in inventory",
            parameters: {
              type: "object",
              properties: {
                bottle_id: {
                  type: "string",
                  description: "Bottle ID to check"
                }
              },
              required: ["bottle_id"]
            }
          },
          {
            type: "function",
            name: "get_drinks_by_filter",
            description: "Find drinks using advanced filtering options",
            parameters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Drink category filter"
                },
                price_range: {
                  type: "string",
                  description: "Price range filter"
                },
                availability: {
                  type: "boolean",
                  description: "Only show available drinks"
                }
              }
            }
          },
          // 📋 ORDER MANAGEMENT TOOLS
          {
            type: "function",
            name: "get_order_details",
            description: "Get detailed information about specific orders",
            parameters: {
              type: "object",
              properties: {
                order_id: {
                  type: "integer",
                  description: "Order ID to retrieve"
                }
              },
              required: ["order_id"]
            }
          },
          {
            type: "function",
            name: "get_orders_list",
            description: "List recent orders with filtering options",
            parameters: {
              type: "object",
              properties: {
                limit: {
                  type: "integer",
                  description: "Number of orders to return",
                  default: 10
                },
                status: {
                  type: "string",
                  description: "Filter by order status"
                }
              }
            }
          },
          {
            type: "function",
            name: "cancel_order",
            description: "Cancel a BEVERAGE order (not events). Use for drink/beverage order cancellations only.",
            parameters: {
              type: "object",
              properties: {
                order_id: {
                  type: "integer",
                  description: "Beverage order ID to cancel"
                },
                reason: {
                  type: "string",
                  description: "Reason for cancellation"
                }
              },
              required: ["order_id"]
            }
          },
          {
            type: "function",
            name: "duplicate_order",
            description: "Create a duplicate of an existing order",
            parameters: {
              type: "object",
              properties: {
                order_id: {
                  type: "integer",
                  description: "Order ID to duplicate"
                }
              },
              required: ["order_id"]
            }
          },
          // 🍸 DRINK MENU MANAGEMENT TOOLS - NEW!
          {
            type: "function",
            name: "create_drink",
            description: "Create a new drink/beverage and add it to the menu. Use when Bev is asked to create, add, or design new drinks. Beer=bottles, Wine=glasses, Spirits=shots, Cocktails=ounces.",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name of the new drink (e.g., 'Lavender Martini', 'Craft IPA')"
                },
                category: {
                  type: "string",
                  description: "Drink category (Beer, Wine, Spirits, Cocktails, Non-Alcoholic)"
                },
                subcategory: {
                  type: "string",
                  description: "Subcategory if applicable (IPA, Chardonnay, Whiskey, etc.)"
                },
                price: {
                  type: "number",
                  description: "Price in dollars (e.g., 12.50)"
                },
                inventory: {
                  type: "integer",
                  description: "Initial inventory count",
                  default: 0
                },
                unit_type: {
                  type: "string",
                  description: "How this drink is tracked: 'bottle' (beer), 'glass' (wine), 'shot' (spirits), 'ounce' (cocktails/mixed)",
                  enum: ["bottle", "glass", "shot", "ounce", "can", "pint"]
                },
                unit_volume_oz: {
                  type: "number",
                  description: "Volume in ounces per serving (1.5 for spirits, 5 for wine, 12 for beer)"
                },
                cost_per_unit: {
                  type: "number",
                  description: "Cost per unit in dollars (optional)"
                },
                description: {
                  type: "string",
                  description: "Description of the drink (optional)"
                },
                image_url: {
                  type: "string",
                  description: "Image URL for the drink (optional)"
                }
              },
              required: ["name", "category", "price"]
            }
          },
          {
            type: "function",
            name: "remove_drink",
            description: "Remove a drink from the menu (soft delete). Use when asked to remove, delete, or discontinue drinks.",
            parameters: {
              type: "object",
              properties: {
                drink_name: {
                  type: "string",
                  description: "Name of the drink to remove"
                },
                drink_id: {
                  type: "integer",
                  description: "ID of the drink to remove (if known)"
                }
              }
            }
          },
          {
            type: "function",
            name: "update_drink_details",
            description: "Update drink information like price, description, or category",
            parameters: {
              type: "object",
              properties: {
                drink_name: {
                  type: "string",
                  description: "Name of the drink to update"
                },
                updates: {
                  type: "object",
                  properties: {
                    price: {
                      type: "number",
                      description: "New price in dollars"
                    },
                    description: {
                      type: "string",
                      description: "New description"
                    },
                    category: {
                      type: "string",
                      description: "New category"
                    },
                    subcategory: {
                      type: "string",
                      description: "New subcategory"
                    }
                  }
                }
              },
              required: ["drink_name", "updates"]
            }
          }
        ]
      }
    };

    dataChannelRef.current.send(JSON.stringify(sessionMessage));
    console.log('📤 Sent enhanced session update with full venue capabilities');
  };

  const sendStartMessage = () => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    const startMessage = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Brief, natural greeting and offer to help.',
        max_output_tokens: 1000
      }
    };

    dataChannelRef.current.send(JSON.stringify(startMessage));
    setLastResponseTime(Date.now());
    console.log('📤 Sent start message');
  };

  const sendMessage = (message: any) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
      console.log('📤 Sent message:', message.type);
      return true;
    }
    console.warn('⚠️ Data channel not open, cannot send message');
    return false;
  };

  const triggerResponse = () => {
    const responseMessage = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        max_output_tokens: 1000
      }
    };
    
    if (sendMessage(responseMessage)) {
      setLastResponseTime(Date.now());
      console.log('⚡ Triggered instant response generation');
    }
  };

  const handleDataChannelMessage = async (message: any) => {
    console.log('📨 Received message:', message.type);

    switch (message.type) {
      case 'session.created':
        console.log('✅ Session created');
        break;

      case 'session.updated':
        console.log('✅ Session updated');
        break;

      case 'response.created':
        currentResponseId.current = message.response?.id || null;
        console.log('🆕 Response created:', currentResponseId.current);
        break;

      case 'response.done':
        console.log('✅ Response completed');
        currentResponseId.current = null;
        setPendingFunctionCalls(new Set());
        setLastResponseTime(Date.now());
        setIsProcessingFunction(false); // Reset processing state when response is done
        
        // Auto-return to wake word mode after a period of inactivity (unless already terminated)
        setTimeout(() => {
          // Only return to wake word mode if we're still in active conversation mode
          // and haven't already been terminated by a terminating phrase
          if (isListening && !isWakeWordMode && !isProcessing) {
            console.log('🔄 Auto-returning to wake word mode after conversation inactivity');
            stopListening(true); // Pass true to return to wake word mode
          }
        }, 10000); // 10 seconds of inactivity before returning to wake word mode
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🗣️ Speech detected');
        setIsProcessing(true);
        setTranscript('');
        
        // Clear any ongoing speculative audio when user starts speaking
        if (speculativeTimeoutRef.current) {
          clearTimeout(speculativeTimeoutRef.current);
          speculativeTimeoutRef.current = null;
        }
        audioQueueRef.current = audioQueueRef.current.filter(item => item.type !== 'speculative');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🤐 Speech ended');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (message.transcript) {
          setTranscript(message.transcript);
          console.log('👤 User said:', message.transcript);
          
          // 🎭 IMMEDIATE SPECULATIVE RESPONSE FOR CART OPERATIONS - DISABLED
          // Temporarily disabled until voice matching is configured
          /*
          const transcript = message.transcript.toLowerCase();
          // More specific detection - only trigger for actual cart addition requests
          const isAddingToCart = (
            (transcript.includes('add') && (transcript.includes('to') || transcript.includes('cart'))) ||
            (transcript.includes('get') && (transcript.includes('me') || transcript.includes('a '))) ||
            (transcript.includes('order') && (transcript.includes('me') || transcript.includes('a ') || transcript.includes('i want'))) ||
            (transcript.includes('buy') && transcript.includes('a ')) ||
            (transcript.includes('purchase') && transcript.includes('a ')) ||
            (transcript.includes('i want') || transcript.includes('i need') || transcript.includes('can i get') || transcript.includes('could i get'))
          );
          
          if (isAddingToCart) {
            console.log('🎭 Cart operation detected in transcript, playing immediate speculative response');
            playSpeculativeSentence('add_drink_to_cart');
          }
          */
          
          // Check for terminating phrases to return to wake word mode
          const lowerTranscript = message.transcript.toLowerCase(); // Use the transcript from message
          // Remove punctuation and normalize spacing
          const cleanTranscript = lowerTranscript.replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();
          
          const terminatingPhrases = [
            'thanks bev',
            'thank you bev', 
            'thanks beth',
            'thank you beth',
            'stop listening',
            'that\'s all',
            'that is all',
            'we\'re done',
            'we are done',
            'the order is complete',
            'order is complete',
            'that completes the order',
            'that\'s everything',
            'that is everything',
            'we\'re good',
            'we are good',
            'that\'s it',
            'that is it',
            'i\'m done',
            'i am done',
            'goodbye bev',
            'bye bev',
            'end conversation',
            'thanks',
            'thank you',
            'goodbye',
            'bye',
            'see you later',
            'catch you later',
            'talk to you later'
          ];
          
          const shouldReturnToWakeWord = terminatingPhrases.some(phrase => 
            cleanTranscript === phrase || cleanTranscript.includes(phrase)
          );
          
          if (shouldReturnToWakeWord) {
            console.log('🔄 Terminating phrase detected, returning to wake word mode');
            
            // Immediate return to wake word mode - don't wait for AI to finish
            setTimeout(async () => {
              try {
                await stopListening(true); // Pass true to return to wake word mode
              } catch (error) {
                console.error('❌ Error returning to wake word mode:', error);
                // Fallback: try to start wake word detection directly
                setTimeout(() => {
                  startWakeWordDetection();
                }, 1000);
              }
            }, 1000); // Short delay to allow current response to process
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.error('❌ OpenAI Whisper transcription failed:', message.error);
        setError('Voice recognition failed. Please try speaking again.');
        setIsProcessing(false);
        break;

      case 'response.audio_transcript.delta':
        if (message.delta) {
          setAiResponse(prev => prev + message.delta);
        }
        break;

      case 'response.audio_transcript.done':
        const transcript = message.transcript || '';
        console.log(`🤖 AI said: ${transcript}`);
        setAiResponse(transcript);
        break;

      case 'response.function_call_arguments.delta':
        console.log('🔧 Function call arguments delta:', message);
        // Store function call details
        if (!currentFunctionCall.current) {
          currentFunctionCall.current = {
            name: message.name || message.function?.name || '',
            call_id: message.call_id || message.function?.call_id || '',
            arguments: {},
            argumentsString: ''
          };
          console.log('🔧 Started new function call:', currentFunctionCall.current.name);
          
          // 🎭 TRIGGER SPECULATIVE SENTENCE IMMEDIATELY
          if (currentFunctionCall.current.name) {
            handleEnhancedFunctionCall(currentFunctionCall.current.name, currentFunctionCall.current.call_id);
          }
        }
        // Update function name if not set
        if (!currentFunctionCall.current.name && (message.name || message.function?.name)) {
          currentFunctionCall.current.name = message.name || message.function?.name || '';
          console.log('🔧 Updated function name:', currentFunctionCall.current.name);
          
          // 🎭 TRIGGER SPECULATIVE SENTENCE IF WE JUST GOT THE NAME
          if (currentFunctionCall.current.name) {
            handleEnhancedFunctionCall(currentFunctionCall.current.name, currentFunctionCall.current.call_id);
          }
        }
        // Accumulate delta strings instead of trying to parse incomplete JSON
        if (message.delta) {
          if (!currentFunctionCall.current.argumentsString) {
            currentFunctionCall.current.argumentsString = '';
          }
          currentFunctionCall.current.argumentsString += message.delta;
          console.log('🔧 Accumulated arguments string:', currentFunctionCall.current.argumentsString);
        }
        break;

      case 'response.function_call_arguments.done':
        console.log('🔧 Function call arguments completed:', message.arguments);
        
        // Parse the complete arguments string
        let parsedArguments = {};
        if (currentFunctionCall.current?.argumentsString) {
          try {
            parsedArguments = JSON.parse(currentFunctionCall.current.argumentsString);
            console.log('🔧 Parsed complete arguments:', parsedArguments);
          } catch (error) {
            console.error('❌ Failed to parse function arguments:', error);
            parsedArguments = message.arguments || {};
          }
        } else {
          parsedArguments = message.arguments || {};
        }
        
        // Clear any speculative timeouts since we're about to get real results
        if (speculativeTimeoutRef.current) {
          clearTimeout(speculativeTimeoutRef.current);
          speculativeTimeoutRef.current = null;
        }
        
        if (currentFunctionCall.current) {
          console.log('🔧 Executing function call:', currentFunctionCall.current.name);
          
          // Execute the function call with proper function name using voice-advanced API
          const toolMap: { [key: string]: string } = {
            add_drink_to_cart: 'cart_add',
            remove_drink_from_cart: 'cart_remove',
            clear_cart: 'cart_clear',
            process_order: 'cart_create_order',
            show_cart: 'cart_view',
          };
          const backendTool = toolMap[currentFunctionCall.current.name] || currentFunctionCall.current.name;
          fetch('/api/voice-advanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: backendTool,
              parameters: {
                ...parsedArguments,
                clientId: 'default' // Add consistent client ID
              }
            })
          })
          .then(response => response.json())
          .then(result => {
            console.log('✅ Function call result:', result);
            
            // Reset processing and speculative states
            setIsProcessingFunction(false);
            
            // Special handling for process_order - clear cart immediately since order is complete
            if (currentFunctionCall.current?.name === 'process_order') {
              console.log('🔄 Order processed, clearing cart state immediately');
              // Clear local cart state immediately for better UX
              setCartItems([]);
              setCartTotal(0);
              // Also update from server to ensure sync, with multiple attempts if needed
              setTimeout(() => updateCartDisplay(), 100);
              setTimeout(() => updateCartDisplay(), 500);
              setTimeout(() => updateCartDisplay(), 1000);
            } else if (["add_drink_to_cart", "remove_drink_from_cart", "cart_view", "clear_cart"].includes(currentFunctionCall.current?.name || '')) {
              console.log('🔄 Updating cart display after function:', currentFunctionCall.current?.name);
              updateCartDisplay();
            }
            
            // Send the actual result back to the conversation
            const resultMessage = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: currentFunctionCall.current?.call_id || '',
                output: JSON.stringify(result)
              }
            };
            
            if (sendMessage(resultMessage)) {
              console.log('📤 Sent function call result to conversation');
              
              // 🎯 ENHANCED: Create past-tense confirmation for ordering functions
              const isOrderingFunction = [
                'add_drink_to_cart', 
                'remove_drink_from_cart', 
                'process_order', 
                'clear_cart'
              ].includes(currentFunctionCall.current?.name || '');
              
              // Trigger immediate response after sending function result
              if (dataChannelRef.current?.readyState === 'open') {
                const responseMessage = {
                  type: 'response.create',
                  response: {
                    modalities: ['text', 'audio'],
                    max_output_tokens: 1000, // Unified token limit for all responses
                    instructions: isOrderingFunction ? 
                      "Respond in past tense as if the action has already been completed. Be conversational and engaging while staying efficient." : 
                      "Provide helpful, detailed information based on the function result. Be conversational and thorough."
                  }
                };
                
                if (sendMessage(responseMessage)) {
                  console.log('🎯 Triggered response after function call with enhanced instructions');
                }
              }
            }
            
            // Clear the current function call
            currentFunctionCall.current = null;
          })
          .catch(error => {
            console.error('❌ Function call error:', error);
            setIsProcessingFunction(false);
            currentFunctionCall.current = null;
          });
        }
        break;

      case 'output_audio_buffer.started':
        setIsPlaying(true);
        
        if (wakeWordTimeRef.current) {
          const firstResponseTime = Date.now();
          const latency = firstResponseTime - wakeWordTimeRef.current;
          console.log(`⏱️ Wake-to-Response Latency: ${latency}ms (T0: ${wakeWordTimeRef.current}, T1: ${firstResponseTime})`);
          wakeWordTimeRef.current = null; // Reset for next interaction
        }
        // Aggressively cancel *any* speculative speech (including wake ack)
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          console.log('🛑 [Speculative/Wake Ack] Cancelled all TTS due to real AI audio start');
        }
        break;

      case 'output_audio_buffer.stopped':
        setIsPlaying(false);
        break;

      case 'rate_limits.updated':
        console.log('📊 Rate limits updated:', message.rate_limits);
        // Log rate limits but don't enforce them - we want unlimited usage
        if (message.rate_limits && message.rate_limits.length > 0) {
          message.rate_limits.forEach((limit: any) => {
            console.log(`🚀 Rate limit for ${limit.name}: ${limit.remaining}/${limit.limit} remaining`);
          });
        }
        break;

      case 'error':
        console.error('🚨 OpenAI error:', message.error);
        setError(`OpenAI error: ${message.error.message || 'Unknown error'}`);
        if (message.error.code === 'session_expired') {
          await stopListening();
        }
        break;

      case 'response.output_item.added':
        // Check if this is a function call item
        if (message.item?.type === 'function_call') {
          console.log('🔧 Function call detected:', message.item);
          currentFunctionCall.current = {
            name: message.item.name || '',
            call_id: message.item.call_id || '',
            arguments: {},
            argumentsString: ''
          };
          console.log('🔧 Function call started:', message.item.name);
          
          // 🎭 IMMEDIATELY TRIGGER SPECULATIVE SENTENCE
          if (message.item.name) {
            handleEnhancedFunctionCall(message.item.name, message.item.call_id || '');
          }
        }
        break;
    }
  };

  const handleFunctionCall = async (functionName: string, args: any) => {
    console.log(`🔧 Executing function: ${functionName} with args:`, args);
    let result;
    try {
      switch (functionName) {
        case 'create_drink':
          result = await createDrink(args);
          break;
        // ... existing code ...
      }
    } catch (error) {
      console.error(`❌ Error executing ${functionName}:`, error);
      throw error;
    }
    return result;
  };

  const startListening = async () => {
    if (isListening) return;

    try {
      setIsProcessing(true);
      setError(null);
      setTranscript('');
      setAiResponse('');
      console.log('🚀 Starting voice session...');

      // Parallelize API key fetching and microphone access
      const apiKeyPromise = getApiKey();
      const streamPromise = getMicrophoneAccess();
      
      const [apiKey, stream] = await Promise.all([apiKeyPromise, streamPromise]);
      
      // Setup WebRTC connection with the results
      await setupWebRTCConnection(apiKey, stream);
      
      setIsListening(true);
      setIsProcessing(false);
      console.log('✅ Voice session started');

    } catch (error) {
      console.error('❌ Failed to start voice session:', error);
      setIsProcessing(false);
      setIsListening(false);
      setError(error instanceof Error ? error.message : 'Failed to start voice session');
      cleanup();
    }
  };

  const stopListening = async (shouldReturnToWakeWord: boolean = false) => {
    console.log('🛑 Stopping voice session...', shouldReturnToWakeWord ? '(will return to wake word mode)' : '');
    
    setIsListening(false);
    setIsProcessing(false);
    setIsPlaying(false);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setTranscript('');
    setAiResponse('');
    setPendingFunctionCalls(new Set());
    currentResponseId.current = null;
    
    // Clean up current wake word detection but don't disable mode if we're returning to it
    if (wakeWordRecognitionRef.current) {
      wakeWordRecognitionRef.current.stop();
      wakeWordRecognitionRef.current = null;
    }
    
    if (!shouldReturnToWakeWord) {
      // Only fully disable wake word mode if we're not returning to it
      setIsWakeWordMode(false);
      isWakeWordModeRef.current = false;
      setIsWaitingForWakeWord(false);
      isWaitingForWakeWordRef.current = false;
    }
    
    cleanup();
    
    // Return to wake word mode if requested
    if (shouldReturnToWakeWord) {
      console.log('🔄 Returning to wake word mode...');
      setTimeout(() => {
        startWakeWordDetection();
      }, 500); // Small delay to ensure cleanup is complete
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up voice control...');
    
    // Clear any speculative timeouts
    if (speculativeTimeoutRef.current) {
      clearTimeout(speculativeTimeoutRef.current);
      speculativeTimeoutRef.current = null;
    }
    
    // Reset speculative state
    audioQueueRef.current = [];
    
    // Clean up wake word recognition
    if (wakeWordRecognitionRef.current) {
      wakeWordRecognitionRef.current.stop();
      wakeWordRecognitionRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsProcessing(false);
    setIsProcessingFunction(false);
    setError(null);
    setTranscript('');
    setAiResponse('');
    currentResponseId.current = null;
    currentFunctionCall.current = null;
  };

  const toggleListening = () => {
    if (isListening || isWakeWordModeRef.current) {
      // If currently in any voice mode, stop completely (don't return to wake word)
      stopListening(false);
    } else {
      // If not in voice mode, start wake word detection
      startWakeWordDetection();
    }
  };

  const startWakeWordDetection = async () => {
    try {
      console.log('👂 Starting wake word detection...');
      setIsWaitingForWakeWord(true);
      isWaitingForWakeWordRef.current = true; // Set ref immediately for synchronous access
      setIsWakeWordMode(true);
      isWakeWordModeRef.current = true; // Set ref immediately for synchronous access
      setError(null);
      setTranscript('');
      
      // Set up browser Speech Recognition for wake word detection
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error('❌ Speech Recognition not supported');
        setError('Speech recognition not supported in this browser');
        setIsWaitingForWakeWord(false);
        isWaitingForWakeWordRef.current = false;
        setIsWakeWordMode(false);
        return;
      }
      
      wakeWordRecognitionRef.current = new SpeechRecognition();
      wakeWordRecognitionRef.current.continuous = true;
      wakeWordRecognitionRef.current.interimResults = true;
      wakeWordRecognitionRef.current.lang = 'en-US';
      
      wakeWordRecognitionRef.current.onstart = () => {
        console.log('👂 Wake word detection started successfully');
        setIsWaitingForWakeWord(true);
        isWaitingForWakeWordRef.current = true;
      };
      
      wakeWordRecognitionRef.current.onresult = (event: any) => {
        console.log('👂 Wake word recognition got result:', event);
        console.log('👂 Current isWaitingForWakeWordRef:', isWaitingForWakeWordRef.current);
        console.log('👂 Current isStartingSession:', isStartingSession);
        console.log('👂 Current isListening:', isListening);
        
        // Prevent processing if already transitioning or listening to full conversation
        if (isStartingSession || isListening) {
          console.log('👂 Skipping result - already starting session or in full conversation');
          return;
        }
        
        // Only process if we're actively waiting for wake word (use ref for immediate check)
        if (!isWaitingForWakeWordRef.current) {
          console.log('👂 Skipping result - not actively waiting for wake word');
          return;
        }
        
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
          .toLowerCase()
          .trim();
        
        console.log('👂 Wake word transcript:', transcript);
        
        // Check for wake words: "hey bev", "bev", "beverage"
        const wakeWords = ['hey bev', 'bev', 'beverage'];
        const detectedWakeWord = wakeWords.find(word => transcript.includes(word));
        
        if (detectedWakeWord) {
          console.log('🎯 Wake word detected:', detectedWakeWord);
          wakeWordTimeRef.current = Date.now();
          
          // Immediately set flags to prevent duplicate triggering
          setIsWaitingForWakeWord(false);
          isWaitingForWakeWordRef.current = false; // Update ref immediately
          setIsStartingSession(true);
          
          // Stop wake word recognition immediately
          if (wakeWordRecognitionRef.current) {
            wakeWordRecognitionRef.current.stop();
            wakeWordRecognitionRef.current = null;
          }
          
          // Play wake acknowledgment sound (no speech output from browser)
          if (wakeAckAudioRef.current) {
            wakeAckAudioRef.current.currentTime = 0;
            wakeAckAudioRef.current.play().catch(error => {
              console.warn('⚠️ Could not play wake ack sound:', error);
            });
          }
          
          // Start full conversation mode
          setTimeout(() => {
            startFullConversationMode();
          }, 100); // Minimal delay for immediate response
        }
      };
      
      wakeWordRecognitionRef.current.onerror = (event: any) => {
        console.error('❌ Wake word recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setError('Wake word detection error. Please try again.');
          setIsWaitingForWakeWord(false);
          isWaitingForWakeWordRef.current = false;
          setIsWakeWordMode(false);
          isWakeWordModeRef.current = false;
        }
      };
      
      wakeWordRecognitionRef.current.onend = () => {
        console.log('👂 Wake word recognition ended');
        // If we're still in wake word mode and not transitioning, restart immediately
        if (isWakeWordModeRef.current && !isStartingSession && !isListening && isWaitingForWakeWordRef.current) {
          console.log('🔄 Auto-restarting wake word recognition to maintain listening mode');
          setTimeout(() => {
            if (isWakeWordModeRef.current && !isStartingSession && !isListening) {
              try {
                startWakeWordDetection();
              } catch (error) {
                console.warn('⚠️ Could not restart wake word recognition:', error);
                // Try again after a longer delay
                setTimeout(() => {
                  if (isWakeWordModeRef.current && !isStartingSession && !isListening) {
                    startWakeWordDetection();
                  }
                }, 2000);
              }
            }
          }, 100); // Very short delay for continuous listening
        } else {
          console.log('👂 Not restarting wake word recognition - mode:', isWakeWordModeRef.current, 'starting:', isStartingSession, 'listening:', isListening, 'waiting:', isWaitingForWakeWordRef.current);
        }
      };
      
      // Start the recognition
      console.log('👂 Starting speech recognition...');
      wakeWordRecognitionRef.current.start();
      
    } catch (error) {
      console.error('❌ Failed to start wake word detection:', error);
      setError('Wake word detection failed. Please try again.');
      setIsWaitingForWakeWord(false);
      isWaitingForWakeWordRef.current = false;
      setIsWakeWordMode(false);
    }
  };

  const startFullConversationMode = async () => {
    try {
      // Prevent duplicate sessions
      if (isStartingSession || isListening) {
        console.log('⚠️ Session already starting or active, ignoring duplicate request');
        return;
      }
      
      setIsStartingSession(true);
      console.log('🚀 Starting full conversation mode...');
      
      // Start the full OpenAI Realtime conversation first
      await startListening();
      
      setIsStartingSession(false);
      
    } catch (error) {
      console.error('❌ Failed to start full conversation mode:', error);
      setError('Failed to start conversation. Please try again.');
      setIsStartingSession(false);
    }
  };

  // Enhanced speculative sentence system
  const getSpeculativeSentence = (functionName: string, isOrdering: boolean = false): string => {
    if (isOrdering) {
      return 'I will process your order momentarily.';
    }
    
    const speculativeResponses: { [key: string]: string } = {
      'create_drink': 'I will add this new drink to our menu.',
      'add_drink_to_cart': 'I will add that to your order right now.',
      'remove_drink_from_cart': 'I will remove that from your cart.',
      'process_order': 'I will process your order right away.',
      'get_inventory_status': 'I will check our inventory for you.',
      'book_event': 'I will book that event for you.',
      'create_tab': 'I will set up a new tab.',
      'close_tab': 'I will close that tab for you.',
      'get_sales_report': 'I will pull up that sales report.',
      'update_drink_inventory': 'I will update the inventory.',
      'search_drinks': 'I will search our drink menu.',
      'get_popular_drinks': 'I will find our most popular drinks.',
      'calculate_event_pricing': 'I will calculate the pricing for that event.',
      'get_staff_performance': 'I will look up that staff information.',
      'reconcile_payments': 'I will reconcile those payments.',
      'get_low_inventory_bottles': 'I will check which bottles are running low.',
      'bulk_update_inventory': 'I will update the inventory records.',
      'split_tab': 'I will split that tab for you.',
      'process_payment': 'I will process that payment.',
      'get_order_history': 'I will pull up the order history.',
      'cancel_order': 'I will cancel that order.',
      'refund_order': 'I will process that refund.',
      'duplicate_order': 'I will duplicate that order.',
      'merge_orders': 'I will merge those orders.',
      'predict_demand': 'I will analyze the demand forecast.',
      'optimize_inventory': 'I will optimize the inventory levels.',
      'identify_trends': 'I will identify the current trends.',
      'get_tax_report': 'I will generate that tax report.',
      'export_data': 'I will export that data for you.',
      'assign_order_to_staff': 'I will assign that order.',
      'clock_in_out': 'I will process that time entry.',
      'transfer_inventory': 'I will transfer that inventory.',
      'audit_inventory_discrepancy': 'I will audit that discrepancy.',
      'void_payment': 'I will void that payment.',
      'refund_payment': 'I will process that refund.',
      'get_payment_history': 'I will look up the payment history.',
      'update_event_status': 'I will update that event status.',
      'get_event_bookings': 'I will check the event bookings.',
      'list_event_packages': 'I will show you our event packages.',
      'update_order_status': 'I will update that order status.',
      'delete_drink': 'I will remove that drink from our menu.',
      'update_drink': 'I will update that drink information.',
      'set_drink_active_status': 'I will update that drink status.',
      'get_drinks_by_category': 'I will show you drinks in that category.',
      'add_bottle_to_inventory': 'I will add that bottle to inventory.',
      'record_pour': 'I will record that pour.',
      'mark_bottle_empty': 'I will mark that bottle as empty.',
      'get_bottle_status': 'I will check that bottle status.',
      'add_order_to_tab': 'I will add that order to the tab.',
      'get_tab_details': 'I will get those tab details.',
      'get_open_tabs': 'I will show you the open tabs.',
      'transfer_tab_items': 'I will transfer those tab items.',
      'get_payment_methods': 'I will show you the payment methods.',
      'update_payment_status': 'I will update that payment status.',
      'get_profit_margins': 'I will calculate the profit margins.',
      'create_event_package': 'I will create that event package.',
      'staff_login': 'I will process that login.',
      'get_current_staff': 'I will check the current staff.',
      'get_staff_permissions': 'I will check those permissions.',
      'calculate_waste_reduction': 'I will calculate the waste reduction.',
      'get_order_analytics': 'I will analyze those orders.',
      'list_tax_categories': 'I will show you the tax categories.',
      'list_pour_sizes': 'I will show you the pour sizes.',
      'get_order_details': 'I will get those order details.',
      'get_orders_list': 'I will get the orders list.',
      'get_order_items': 'I will show you those order items.',
      'add_pour_bottle': 'I will add that pour bottle.',
      'get_pour_inventory_status': 'I will check the pour inventory.',
      'get_bottle_details': 'I will get those bottle details.',
      'list_drinks': 'I will show you our drink list.',
      'check_drink_availability': 'I will check if that drink is available.',
      'generate_stock_report': 'I will generate that stock report.',
      'get_drink_details': 'I will get those drink details.',
      'get_drinks_by_filter': 'I will filter the drinks for you.',
      'get_low_stock_drinks': 'I will find drinks that are low in stock.',
      'cart_view': 'I will show you your current cart.',
      'clear_cart': 'I will clear your cart for you.'
    };

    return speculativeResponses[functionName] || 'I will take care of that for you.';
  };

  const playSpeculativeSentence = (functionName: string) => {
    // 🔇 SPECULATIVE SPEECH DISABLED - Temporarily disabled until voice matching is configured
    console.log(`🔇 Speculative speech disabled for ${functionName}`);
    return;
    
    // Check if WebRTC connection exists (more lenient check)
    const connection = peerConnectionRef.current;
    if (!connection) {
      console.log('⚠️ Speculative speech not played: no connection');
      return;
    }
    
    if (connection.connectionState === 'closed' || connection.connectionState === 'failed') {
      console.log('⚠️ Speculative speech not played: connection closed/failed');
      return;
    }
    
    const sentence = getSpeculativeSentence(functionName);
    console.log(`🎭 Playing speculative sentence for ${functionName}: "${sentence}"`);

    // Cancel any existing speculative speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Clear any existing speculative timeout
    if (speculativeTimeoutRef.current) {
      console.log(`🧹 Clearing existing speculative timeout`);
      clearTimeout(speculativeTimeoutRef.current);
      speculativeTimeoutRef.current = null;
    }

    // For cart operations, add multiple speculative sentences to fill the gap
    const isCartOperation = ['add_drink_to_cart', 'remove_drink_from_cart', 'process_order', 'clear_cart'].includes(functionName);
    
    if (isCartOperation) {
      // Add primary speculative sentence
      audioQueueRef.current.push({
        type: 'speculative',
        text: sentence,
        timestamp: Date.now(),
        priority: 'high'
      });

      // Add follow-up sentence after 2 seconds if still processing
      setTimeout(() => {
        if (isProcessingFunction && audioQueueRef.current.some(item => item.type === 'speculative')) {
          audioQueueRef.current.push({
            type: 'speculative',
            text: 'Just a moment while I update that for you.',
            timestamp: Date.now(),
            priority: 'medium'
          });
          setTimeout(() => processAudioQueue(), 10);
        }
      }, 2000);

      // Add final follow-up after 4 seconds if still processing
      setTimeout(() => {
        if (isProcessingFunction && audioQueueRef.current.some(item => item.type === 'speculative')) {
          audioQueueRef.current.push({
            type: 'speculative',
            text: 'Almost done processing that.',
            timestamp: Date.now(),
            priority: 'low'
          });
          setTimeout(() => processAudioQueue(), 10);
        }
      }, 4000);
    } else {
      // Regular single speculative sentence for non-cart operations
      audioQueueRef.current.push({
        type: 'speculative',
        text: sentence,
        timestamp: Date.now()
      });
    }

    // Start processing the queue immediately with no delay
    setTimeout(() => processAudioQueue(), 10); // Even faster for cart operations

    // Set a longer timeout for cart operations
    const timeoutDuration = isCartOperation ? 6000 : 1500;
    speculativeTimeoutRef.current = setTimeout(() => {
      console.log(`⏰ Speculative sentence timeout for ${functionName}`);
      // Remove any remaining speculative items from queue
      audioQueueRef.current = audioQueueRef.current.filter(item => item.type !== 'speculative');
      speculativeTimeoutRef.current = null;
    }, timeoutDuration);
  };

  const processAudioQueue = () => {
    if (audioQueueRef.current.length === 0 || isProcessingAudioRef.current) {
      console.log(`🎵 Audio queue check: length=${audioQueueRef.current.length}, processing=${isProcessingAudioRef.current}`);
      return;
    }

    const nextItem = audioQueueRef.current.shift();
    if (!nextItem) {
      console.log(`🎵 No audio items in queue`);
      return;
    }

    isProcessingAudioRef.current = true;
    console.log(`🎵 Processing audio queue item:`, nextItem);

    if (nextItem.type === 'speculative') {
      console.log(`🗣️ Starting speech synthesis for: "${nextItem.text}"`);
      
      // Play speculative sentence using text-to-speech with optimized settings
      if ('speechSynthesis' in window) {
        // Cancel any existing speech first
        window.speechSynthesis.cancel();
        
        // Wait a moment for cancellation to complete
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(nextItem.text);
          utterance.rate = 2.1; // Even faster for immediate responsiveness
          utterance.pitch = 1.0;
          utterance.volume = 1.0; // Full volume for clarity
          
          utterance.onstart = () => {
            console.log(`🗣️ Speech synthesis STARTED: "${nextItem.text}"`);
          };
          
          utterance.onend = () => {
            console.log(`✅ Speech synthesis COMPLETED: "${nextItem.text}"`);
            isProcessingAudioRef.current = false;
            // Continue processing queue immediately
            setTimeout(() => processAudioQueue(), 10);
          };

          utterance.onerror = (event) => {
            console.log(`❌ Speech synthesis ERROR: ${event.error} for "${nextItem.text}"`);
            isProcessingAudioRef.current = false;
            setTimeout(() => processAudioQueue(), 10);
          };

          // Start speaking immediately
          console.log(`🎤 Calling speechSynthesis.speak() for: "${nextItem.text}"`);
          window.speechSynthesis.speak(utterance);
          
          // Backup timeout in case speech synthesis doesn't fire events properly
          setTimeout(() => {
            if (isProcessingAudioRef.current) {
              console.log(`⏰ Speech synthesis timeout backup for: "${nextItem.text}"`);
              isProcessingAudioRef.current = false;
              setTimeout(() => processAudioQueue(), 10);
            }
          }, 5000);
          
        }, 50); // Small delay after cancellation
        
      } else {
        // Fallback if speech synthesis not available
        console.log(`🔧 Speech synthesis NOT AVAILABLE, using console log: "${nextItem.text}"`);
        isProcessingAudioRef.current = false;
        setTimeout(() => processAudioQueue(), 10);
      }
    } else {
      // Handle other audio types (actual AI responses)
      console.log(`🎵 Non-speculative audio item processed`);
      isProcessingAudioRef.current = false;
      setTimeout(() => processAudioQueue(), 10);
    }
  };

  const handleEnhancedFunctionCall = (functionName: string, callId: string) => {
    console.log(`🎯 Enhanced function call detected: ${functionName} (${callId})`);
    
    // Immediately play speculative sentence for sub-second response
    playSpeculativeSentence(functionName);
    
    // Track the function call
    setIsProcessingFunction(true);
    
    // For cart operations, also update the cart display optimistically
    if (["add_drink_to_cart", "remove_drink_from_cart", "clear_cart"].includes(functionName)) {
      console.log('🛒 Cart operation detected, will update display after completion');
    }
    
    // Enhanced message handling to clear speculative responses instantly when real audio arrives
    const checkForRealResponse = () => {
      // If we detect any actual audio response, immediately clear speculative content
      if (isPlaying) {
        console.log('🎵 Real audio detected, clearing speculative responses');
        if (speculativeTimeoutRef.current) {
          clearTimeout(speculativeTimeoutRef.current);
          speculativeTimeoutRef.current = null;
        }
        // Remove speculative items from queue
        audioQueueRef.current = audioQueueRef.current.filter(item => item.type !== 'speculative');
        
        // Stop any ongoing speech synthesis
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        isProcessingAudioRef.current = false;
      } else if (isProcessingFunction) {
        // Keep checking for real responses while function is still processing
        setTimeout(checkForRealResponse, 50); // Check more frequently
      }
    };
    
    // Start monitoring for real responses immediately
    setTimeout(checkForRealResponse, 50);
  };

  const createDrink = async (args: any) => {
    try {
      const response = await fetch('/api/mcp/create-drink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      if (!response.ok) {
        throw new Error(`Failed to create drink: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`✅ Drink created:`, data);
      return { content: [data], isError: false };
    } catch (error) {
      console.error(`❌ Error creating drink:`, error);
      return { content: [{ error: 'Failed to create drink' }], isError: true };
    }
  };

  // Function to play immediate local sound acknowledgement for wake word
  const playWakeWordAcknowledgement = () => {
    console.log('🔔 [Wake Ack] Attempting to play sound');
    if (wakeAckAudioRef.current) {
      // Ensure sound is reset if it was played recently and interrupted
      wakeAckAudioRef.current.currentTime = 0;
      wakeAckAudioRef.current.play().catch(error => {
        console.warn('❌ [Wake Ack] Error playing sound:', error);
      });
    } else {
      console.warn('❌ [Wake Ack] Audio element not initialized.');
    }
  };

  // updateCartDisplay function must remain here, it was accidentally removed.
  const updateCartDisplay = async () => {
    try {
      const response = await fetch('/api/voice-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cart_view',
          parameters: { clientId: 'default' } // Add consistent client ID
        })
      });
      
      if (response.ok) {
        const mcpResult = await response.json();
        console.log('🛒 MCP cart data:', mcpResult);
        
        // Handle both MCP result formats
        let cartText = '';
        if (mcpResult.result && mcpResult.result.content && mcpResult.result.content[0]) {
          cartText = mcpResult.result.content[0].text;
        } else if (mcpResult.content && mcpResult.content[0]) {
          cartText = mcpResult.content[0].text;
        }
        
        if (cartText) {
          const lines = cartText.split('\n');
          const items = [];
          let total = 0;
          
          // Check if cart is explicitly empty
          if (cartText.toLowerCase().includes('empty') || cartText.toLowerCase().includes('no items')) {
            setCartItems([]);
            setCartTotal(0);
            return;
          }
          
          for (const line of lines) {
            const itemMatch = line.match(/(\d+)x\s+(.+?)\s+-\s+\$(\d+\.\d+)/);
            if (itemMatch) {
              const [, quantity, name, subtotal] = itemMatch;
              const price = parseFloat(subtotal) / parseInt(quantity);
              items.push({
                name: name.trim(),
                quantity: parseInt(quantity),
                price: price,
                subtotal: parseFloat(subtotal),
                category: 'Beverage' // Assuming default category
              });
            }
            const totalMatch = line.match(/Total:\s+\$(\d+\.\d+)/);
            if (totalMatch) {
              total = parseFloat(totalMatch[1]);
            }
          }
          
          setCartItems(items);
          setCartTotal(total);
        } else {
          // No cart text found, cart is empty
          setCartItems([]);
          setCartTotal(0);
        }
      }
    } catch (error) {
      console.error('Error updating cart display:', error);
      // Don't clear cart on error, keep current state
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Hidden audio elements for sound effects */}
      <audio ref={audioElementRef} style={{ display: 'none' }} />
      <audio ref={wakeAckAudioRef} preload="auto" style={{ display: 'none' }}>
        <source src="/chime.mp3" type="audio/mpeg" />
      </audio>

      {/* Voice assistant toggle button - redesigned to match footer banner theme */}
      <button
        onClick={toggleListening}
        className={`relative group p-3 rounded-xl transition-all duration-300 ${
          isListening || isWakeWordMode 
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/20' 
            : 'bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md shadow-sm'
        } ${isProcessing ? 'animate-pulse' : ''}`}
        disabled={isProcessing}
        title={isListening || isWakeWordMode ? 'Voice Assistant Active' : 'Start Voice Assistant'}
      >
        {/* Subtle background glow for active state */}
        {(isListening || isWakeWordMode) && (
          <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse"></div>
        )}
        
        {/* Voice icon with improved states */}
        <div className="relative z-10">
          {isListening || isWakeWordMode ? (
            <div className="flex items-center justify-center space-x-0.5">
              {/* Audio waveform visualization */}
              <div className={`w-1 h-3 bg-current rounded-full ${isProcessing ? 'animate-pulse' : 'animate-bounce'} delay-0`}></div>
              <div className={`w-1 h-5 bg-current rounded-full ${isProcessing ? 'animate-pulse' : 'animate-bounce'} delay-75`}></div>
              <div className={`w-1 h-4 bg-current rounded-full ${isProcessing ? 'animate-pulse' : 'animate-bounce'} delay-150`}></div>
              <div className={`w-1 h-3 bg-current rounded-full ${isProcessing ? 'animate-pulse' : 'animate-bounce'} delay-225`}></div>
              <div className={`w-1 h-2 bg-current rounded-full ${isProcessing ? 'animate-pulse' : 'animate-bounce'} delay-300`}></div>
            </div>
          ) : (
            <svg 
              className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2C13.1 2 14 2.9 14 4V12C14 13.1 13.1 14 12 14C10.9 14 10 13.1 10 12V4C10 2.9 10.9 2 12 2ZM19 10V12C19 15.3 16.3 18 13 18V20H18V22H6V20H11V18C7.7 18 5 15.3 5 12V10H7V12C7 14.2 8.8 16 11 16H13C15.2 16 17 14.2 17 12V10H19Z"/>
            </svg>
          )}
        </div>

        {/* Status indicator dot - more subtle */}
        {(isListening || isWakeWordMode) && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white shadow-sm animate-pulse"></div>
        )}
      </button>

      {/* Status text below button - refined typography */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <p className="text-xs font-medium text-gray-500 text-center">
          {isWakeWordMode ? 'Say "Hey Bev"' : 
           isListening ? 'Listening...' : 
           isProcessing ? 'Processing...' : 
           ''}
        </p>
        {error && (
          <p className="text-xs text-red-500 mt-1 text-center">
            Connection Error
          </p>
        )}
      </div>
    </div>
  );
}