'use client';

import { useState, useEffect, useRef } from 'react';

function normalizeDrinkName(name: string): string {
  if (!name || name === 'Unknown Drink') return name;
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
  if (normalizations[lowerName]) {
    return normalizations[lowerName];
  }
  for (const [key, value] of Object.entries(normalizations)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return value;
    }
  }
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
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
  const [isProcessingFunction, setIsProcessingFunction] = useState(false);
  const [queuedResponse, setQueuedResponse] = useState<string | null>(null);
  const [voiceConfig, setVoiceConfig] = useState({
    provider: 'openai',
    voice: 'shimmer',
    rate: 1.4,
    temperature: 0.6,
    vad_threshold: 0.3,
    prefix_padding: 300,
    silence_duration: 800,
    max_tokens: 2500,
    response_style: 'efficient',
    audio_gain: 1.0,
    noise_suppression: true,
    echo_cancellation: true,
    personality_mode: 'professional',
    verbosity: 'balanced'
  });
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  const responseDelayMs = 0;
  const currentResponseId = useRef<string | null>(null);
  const currentFunctionCall = useRef<{ name: string; call_id: string; arguments?: any; argumentsString?: string } | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
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
  const [isWakeWordMode, setIsWakeWordMode] = useState(false);
  const [isWaitingForWakeWord, setIsWaitingForWakeWord] = useState(false);
  const wakeWordRecognitionRef = useRef<any>(null);
  const isWaitingForWakeWordRef = useRef<boolean>(false);
  const isWakeWordModeRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const wakeWordTimeRef = useRef<number | null>(null);
  const wakeAckAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    wakeAckAudioRef.current = new Audio('/sounds/wake-ack.mp3');
    wakeAckAudioRef.current.volume = 0.5;
    wakeAckAudioRef.current.preload = 'auto'; 
    initializeAudioElement(); 
    checkApiKeyStatus();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for cart updates from other components
    const handleCartUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔊 Voice control received cart update:', customEvent.detail);
      // Update any local cart state if needed
    };
    
    const handleOrderUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔊 Voice control received order update:', customEvent.detail);
      // Handle order completion from UI
    };
    
    // Add event listeners
    window.addEventListener('realtime-cart_update', handleCartUpdate);
    window.addEventListener('realtime-order_update', handleOrderUpdate);
    
    return () => {
      if (!isListeningRef.current && !isWakeWordModeRef.current) {
        cleanup();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Clean up event listeners
      window.removeEventListener('realtime-cart_update', handleCartUpdate);
      window.removeEventListener('realtime-order_update', handleOrderUpdate);
    };
  }, []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isWakeWordModeRef.current = isWakeWordMode;
  }, [isWakeWordMode]);

  const handleVisibilityChange = () => {
    if (document.hidden) {
    } else {
    }
  };

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

  const initializeAudioElement = () => {
    audioElementRef.current = document.createElement('audio');
    audioElementRef.current.autoplay = true;
    audioElementRef.current.style.display = 'none';
    audioElementRef.current.controls = false;
    audioElementRef.current.muted = false;
    audioElementRef.current.volume = 1.0;
    audioElementRef.current.preload = 'auto';
    audioElementRef.current.addEventListener('canplay', () => {});
    audioElementRef.current.addEventListener('play', () => {});
    audioElementRef.current.addEventListener('error', (e) => {});
    document.body.appendChild(audioElementRef.current);
  };

  const checkApiKeyStatus = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const hasValidKey = data.openaiKey && data.openaiKey !== 'your-openai-api-key-here';
        setApiKeyValid(hasValidKey);
        const configData = data.config || data;
        if (configData.tts_provider && configData.tts_provider === 'openai') {
          setVoiceConfig({
            provider: configData.tts_provider,
            voice: configData.tts_voice || configData.voice || 'shimmer',
            rate: configData.rate || 1.0,
            temperature: configData.temperature || 0.5,
            vad_threshold: configData.vad_threshold || 0.4,
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
          setVoiceConfig({
            provider: 'openai',
            voice: configData.voice,
            rate: configData.rate || 1.0,
            temperature: configData.temperature || 0.5,
            vad_threshold: configData.vad_threshold || 0.4,
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
      setApiKeyValid(false);
      setError('Failed to check API configuration.');
    }
  };

  const getApiKey = async () => {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Failed to get config: ${response.status}`);
      }
      const data = await response.json();
      if (!data.openaiKey || data.openaiKey === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key not configured. Please update your .env file.');
      }
      return data.openaiKey;
    } catch (error) {
      throw error;
    }
  };

  const getMicrophoneAccess = async () => {
    try {
      const baseConstraints: MediaTrackConstraints = {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: voiceConfig.echo_cancellation,
          noiseSuppression: voiceConfig.noise_suppression,
          autoGainControl: true
      };
      const enhancedConstraints = {
        ...baseConstraints,
        ...(navigator.userAgent.includes('Chrome') && {
          googEchoCancellation: voiceConfig.echo_cancellation,
          googAutoGainControl: true,
          googNoiseSuppression: voiceConfig.noise_suppression,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
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
      return stream;
    } catch (error) {
      throw new Error('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const setupWebRTCConnection = async (apiKey: string, stream: MediaStream) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        iceCandidatePoolSize: 0,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });
      peerConnectionRef.current = pc;
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
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
            break;
        }
      };
      pc.ontrack = (event) => {
        if (audioElementRef.current && event.streams[0]) {
          const stream = event.streams[0];
          audioElementRef.current.srcObject = stream;
          try {
            if (!audioContextRef.current) {
              const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
              audioContextRef.current = new AudioCtx();
              gainNodeRef.current = audioContextRef.current.createGain();
              gainNodeRef.current.connect(audioContextRef.current.destination);
            }
            const context = audioContextRef.current;
            const gainNode = gainNodeRef.current;
            if (context && gainNode) {
              const source = context.createMediaStreamSource(stream);
              source.connect(gainNode);
              if (context.state === 'suspended') {
                context.resume().then(() => {});
              }
            }
          } catch (webAudioError) {}
          audioElementRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch((error) => {
            if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
              const AudioCtx = AudioContext || (window as any).webkitAudioContext;
              const audioContext = new AudioCtx();
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  audioElementRef.current?.play().catch(() => {});
                });
              }
            }
          });
        }
      };
      const audioTrack = stream.getAudioTracks()[0];
      pc.addTrack(audioTrack, stream);
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      dc.onopen = () => {
        sendSessionUpdate();
        sendStartMessage();
      };
      dc.onmessage = (event) => {
        handleDataChannelMessage(JSON.parse(event.data));
      };
      await pc.setLocalDescription();
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
      setError(null);
      setApiKeyValid(true);
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
        checkConnection();
        pc.addEventListener('connectionstatechange', () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            if (isListening) {
              setError('Connection temporarily lost, but session maintained');
            }
          } else if (pc.connectionState === 'connected') {
            setError(null);
          }
        });
      });
    } catch (error) {
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
Bev: "Perfect! I've added champagne to your cart for $45."

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
        temperature: voiceConfig.temperature,
        modalities: ['text', 'audio'],
        tool_choice: 'auto',
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
  };

  const sendMessage = (message: any) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
      return true;
    }
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
    }
  };

  const handleDataChannelMessage = async (message: any) => {
    switch (message.type) {
      case 'session.created':
        break;
      case 'session.updated':
        break;
      case 'response.done':
        currentResponseId.current = null;
        setPendingFunctionCalls(new Set());
        setLastResponseTime(Date.now());
        setIsProcessingFunction(false);
        setIsListening(true);
        setIsConnected(true);
        setConnectionStatus('connected');
        break;
      case 'input_audio_buffer.speech_started':
        setIsProcessing(true);
        setTranscript('');
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
        break;
      case 'conversation.item.input_audio_transcription.completed':
          if (message.transcript) {
            setTranscript(message.transcript);
            const lowerTranscript = message.transcript.toLowerCase();
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
              'end conversation'
            ];
            const shouldReturnToWakeWord = terminatingPhrases.some(phrase => 
              cleanTranscript === phrase
            );
            if (shouldReturnToWakeWord) {
              setTimeout(async () => {
                try {
                  await stopListening(true); 
                } catch (error) {
                  setTimeout(() => {
                    startWakeWordDetection();
                  }, 1000);
                }
              }, 1000);
            }
          }
          break;
      case 'conversation.item.input_audio_transcription.failed':
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
        setAiResponse(transcript);
        break;
      case 'response.function_call_arguments.delta':
        if (!currentFunctionCall.current) {
          currentFunctionCall.current = {
            name: message.name || message.function?.name || '',
            call_id: message.call_id || message.function?.call_id || '',
            arguments: {},
            argumentsString: ''
          };
          if (currentFunctionCall.current.name) {
            handleEnhancedFunctionCall(currentFunctionCall.current.name, currentFunctionCall.current.call_id);
          }
        }
        if (!currentFunctionCall.current.name && (message.name || message.function?.name)) {
          currentFunctionCall.current.name = message.name || message.function?.name || '';
          if (currentFunctionCall.current.name) {
            handleEnhancedFunctionCall(currentFunctionCall.current.name, currentFunctionCall.current.call_id);
          }
        }
        if (message.delta) {
          if (!currentFunctionCall.current.argumentsString) {
            currentFunctionCall.current.argumentsString = '';
          }
          currentFunctionCall.current.argumentsString += message.delta;
        }
        break;
      case 'response.function_call_arguments.done':
        let parsedArguments = {};
        if (currentFunctionCall.current?.argumentsString) {
          try {
            parsedArguments = JSON.parse(currentFunctionCall.current.argumentsString);
          } catch (error) {
            parsedArguments = message.arguments || {};
          }
        } else {
          parsedArguments = message.arguments || {};
        }
        if (speculativeTimeoutRef.current) {
          clearTimeout(speculativeTimeoutRef.current);
          speculativeTimeoutRef.current = null;
        }
        if (currentFunctionCall.current) {
          const isCartOperation = ['add_drink_to_cart', 'remove_drink_from_cart', 'clear_cart', 'process_order', 'cart_view'].includes(currentFunctionCall.current.name);
          const apiEndpoint = isCartOperation ? '/api/voice-cart-direct' : '/api/voice-advanced';
          const toolMap: { [key: string]: string } = {
            add_drink_to_cart: 'cart_add',
            remove_drink_from_cart: 'cart_remove',
            clear_cart: 'cart_clear',
            process_order: 'cart_create_order',
            cart_view: 'cart_view',
          };
          const backendTool = toolMap[currentFunctionCall.current.name] || currentFunctionCall.current.name;
          fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: backendTool,
              parameters: {
                ...parsedArguments,
                clientId: 'default'
              }
            })
          })
          .then(response => response.json())
          .then(result => {
            setIsProcessingFunction(false);
            if (currentFunctionCall.current?.name === 'add_drink_to_cart' && result.success) {
              const drinkName = (parsedArguments as any).drink_name;
              const quantity = (parsedArguments as any).quantity || 1;
              setTimeout(() => {
                updateCartDisplay();
              }, 100);
              window.dispatchEvent(new CustomEvent('realtime-cart_update', { 
                detail: { action: 'add', drink: drinkName, quantity } 
              }));
            }
            if (currentFunctionCall.current?.name === 'process_order') {
              window.dispatchEvent(new CustomEvent('realtime-order_update', { 
                detail: { type: 'order_completed', ...result } 
              }));
              setTimeout(() => updateCartDisplay(), 200);
            } else if (["add_drink_to_cart", "remove_drink_from_cart", "cart_view", "clear_cart"].includes(currentFunctionCall.current?.name || '')) {
              setTimeout(() => {
                updateCartDisplay();
              }, 150);
            }
            const resultMessage = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: currentFunctionCall.current?.call_id || '',
                output: JSON.stringify(result)
              }
            };
            if (sendMessage(resultMessage)) {
              const isOrderingFunction = [
                'add_drink_to_cart', 
                'remove_drink_from_cart', 
                'process_order', 
                'clear_cart'
              ].includes(currentFunctionCall.current?.name || '');
              if (dataChannelRef.current?.readyState === 'open') {
                const responseMessage = {
                  type: 'response.create',
                  response: {
                    modalities: ['text', 'audio'],
                    max_output_tokens: 1000,
                    instructions: isOrderingFunction ? 
                      "Respond in past tense as if the action has already been completed. Be conversational and engaging while staying efficient. After confirming the action, ask if there's anything else you can help with to keep the conversation active." : 
                      "Provide helpful, detailed information based on the function result. Be conversational and thorough. Ask if there's anything else you can help with to keep the conversation active."
                  }
                };
                if (sendMessage(responseMessage)) {
                }
              }
            }
            const completedFunctionName = currentFunctionCall.current?.name;
            currentFunctionCall.current = null;
          })
          .catch(error => {
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
          wakeWordTimeRef.current = null;
        }
        if ('speechSynthesis' in window && audioQueueRef.current.some(item => item.type === 'speculative')) {
          window.speechSynthesis.cancel();
        }
        break;
      case 'output_audio_buffer.stopped':
        setIsPlaying(false);
        break;
      case 'rate_limits.updated':
        break;
      case 'error':
        setError(`OpenAI error: ${message.error.message || 'Unknown error'}`);
        if (message.error.code === 'session_expired') {
          await stopListening();
        }
        break;
      case 'response.output_item.added':
        if (message.item?.type === 'function_call') {
          currentFunctionCall.current = {
            name: message.item.name || '',
            call_id: message.item.call_id || '',
            arguments: {},
            argumentsString: ''
          };
          if (message.item.name) {
            handleEnhancedFunctionCall(message.item.name, message.item.call_id || '');
          }
        }
        break;
    }
  };

  const handleFunctionCall = async (functionName: string, args: any) => {
    let result;
    try {
      switch (functionName) {
        case 'create_drink':
          result = await createDrink(args);
          break;
      }
    } catch (error) {
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
      if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
        const AudioCtx = AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioCtx();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('🔊 Audio context resumed for voice session');
        }
      }

      // Parallelize API key fetching and microphone access
      console.log('🔑 Creating API key and microphone promises...');
      const apiKeyPromise = getApiKey();
      const streamPromise = getMicrophoneAccess();
      
      console.log('⏳ Waiting for API key and microphone access...');
      const [apiKey, stream] = await Promise.all([apiKeyPromise, streamPromise]);
      
      console.log('✅ Both API key and stream obtained, setting up WebRTC...');
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
      cleanup(); // Only cleanup if completely stopping
    } else {
        // If returning to wake word mode, perform a partial cleanup of the WebRTC connection
        // to ensure a fresh start for the next full conversation.
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
    }
    
    // Return to wake word mode if requested
    if (shouldReturnToWakeWord) {
      console.log('🔄 Returning to wake word mode...');
      setTimeout(() => {
        startWakeWordDetection();
      }, 500);
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
    
    // Full WebRTC cleanup
    if (peerConnectionRef.current) {
      console.log('🔌 Closing WebRTC connection for full cleanup');
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
      // If currently in any voice mode, stop completely
      console.log('🛑 User requested to stop voice control completely');
      stopListening(false);
    } else {
      // If not in voice mode, start wake word detection
      console.log('🎤 User requested to start voice control');
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
      
      // Ensure microphone access before starting recognition
      await getMicrophoneAccess();

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
        
        // Check for wake words with variations and partial matches
        const wakeWords = [
          'hey bev', 'bev', 'beverage',
          'hey babe', 'babe',  // Common misinterpretations
          'hey beth', 'beth',  // Another common misinterpretation
          'hey dev', 'dev',    // Technical misinterpretation
          'hey rev', 'rev',    // Similar sounding
          'hey beb', 'beb',    // Partial match
          'hey bed', 'bed',    // Close pronunciation
          'hey best', 'best',  // Similar ending
          'hey bet', 'bet',    // Short variation
          'bevvy', 'bevy',     // Nickname variations
          'beverage pos', 'pos', // System specific
          'hello bev', 'hi bev', // Alternative greetings
          'okay bev', 'ok bev', // Alternative wake phrases
          'yo bev', 'hey bevvy', // Casual variations
          'bevy', 'bebby'      // Cute variations
        ];
        
        const detectedWakeWord = wakeWords.find(word => transcript.includes(word));
        
        if (detectedWakeWord) {
          console.log('🎯 Wake word detected:', detectedWakeWord, 'from transcript:', transcript);
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
        if (event.error === 'network') {
             setError('Network error with wake word detection. Please check your connection.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError('Wake word detection error. Please try again.');
        }
        // Don't disable wake word mode on common errors like 'no-speech'
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setError('Microphone access was denied. Please enable it in your browser settings.');
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
          // A short delay helps prevent rapid-fire restarts on some browsers
          setTimeout(() => {
            if (isWakeWordModeRef.current && !isStartingSession && !isListening) {
              try {
                // Check if recognition object still exists before starting
                if (wakeWordRecognitionRef.current) {
                    wakeWordRecognitionRef.current.start();
                } else {
                    // If it was cleared, re-initialize
                    startWakeWordDetection();
                }
              } catch (error) {
                console.warn('⚠️ Could not restart wake word recognition, re-initializing:', error);
                startWakeWordDetection();
              }
            }
          }, 250);
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
      if (isListening) {
        console.log('⚠️ Session already active, ignoring duplicate request');
        return;
      }
      
      setIsStartingSession(true);
      console.log('🚀 Starting full conversation mode...');
      
      // Stop any lingering wake word processes
      if (wakeWordRecognitionRef.current) {
        wakeWordRecognitionRef.current.stop();
        wakeWordRecognitionRef.current = null;
      }
      
      // Start the full OpenAI Realtime conversation
      await startListening();
      
      setIsStartingSession(false);
      
    } catch (error) {
      console.error('❌ Failed to start full conversation mode:', error);
      setError('Failed to start conversation. Please try again.');
      setIsStartingSession(false);
      // If it fails, try to go back to wake word mode
      await stopListening(true);
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
      return;
    }

    const nextItem = audioQueueRef.current.shift();
    if (!nextItem) {
      return;
    }

    isProcessingAudioRef.current = true;

    if (nextItem.type === 'speculative') {
      if ('speechSynthesis' in window) {
        // Cancel any existing speech first
        window.speechSynthesis.cancel();
        
        // Wait a moment for cancellation to complete
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(nextItem.text);
          utterance.rate = 2.1; // Even faster for immediate responsiveness
          utterance.pitch = 1.0;
          utterance.volume = 1.0; // Full volume for clarity
          
          utterance.onend = () => {
            isProcessingAudioRef.current = false;
            // Continue processing queue immediately
            setTimeout(() => processAudioQueue(), 10);
          };

          utterance.onerror = (event) => {
            console.error(`❌ Speech synthesis ERROR: ${event.error} for "${nextItem.text}"`);
            isProcessingAudioRef.current = false;
            setTimeout(() => processAudioQueue(), 10);
          };

          window.speechSynthesis.speak(utterance);
          
        }, 50);
        
      } else {
        isProcessingAudioRef.current = false;
        setTimeout(() => processAudioQueue(), 10);
      }
    } else {
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
    
    // Enhanced message handling to clear speculative responses instantly when real audio arrives
    const checkForRealResponse = () => {
      if (isPlaying) {
        if (speculativeTimeoutRef.current) {
          clearTimeout(speculativeTimeoutRef.current);
          speculativeTimeoutRef.current = null;
        }
        audioQueueRef.current = audioQueueRef.current.filter(item => item.type !== 'speculative');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        isProcessingAudioRef.current = false;
      } else if (isProcessingFunction) {
        setTimeout(checkForRealResponse, 50);
      }
    };
    
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

  // Debounce timer for cart updates
  const cartUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // updateCartDisplay function - now uses direct WebSocket connection with debouncing
  const updateCartDisplay = async () => {
    // Clear any pending update
    if (cartUpdateTimeoutRef.current) {
      clearTimeout(cartUpdateTimeoutRef.current);
    }
    
    // Debounce the actual update
    cartUpdateTimeoutRef.current = setTimeout(async () => {
    try {
      // Get cart data from MCP server
      const response = await fetch('/api/voice-cart-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cart_view',
          parameters: { clientId: 'default' }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.cart) {
          // Try direct function call first, then fallback to custom event
          if ((window as any).updateCartFromData) {
            (window as any).updateCartFromData({
              items: result.cart,
              total: result.total || 0,
              clientId: 'default'
            }, 'voice-control');
          } else {
            // Trigger a custom event to notify the main component
            window.dispatchEvent(new CustomEvent('cartUpdateRequested', {
              detail: {
                items: result.cart,
                total: result.total || 0,
                clientId: 'default'
              }
            }));
          }
        }
      }
    } catch (error) {
      console.error('🔌 [PREMIUM] Cart display update error:', error);
    }
    }, 200); // 200ms debounce delay to reduce rerender frequency
  };

  return (
    <div className="flex justify-center items-center p-6">
      {/* Hidden audio elements for sound effects */}
      <audio ref={audioElementRef} style={{ display: 'none' }} />
      <audio ref={wakeAckAudioRef} preload="auto" style={{ display: 'none' }}>
        <source src="/chime.mp3" type="audio/mpeg" />
      </audio>

      {/* Minimalist circular voice button with glossy design */}
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`relative w-20 h-20 rounded-full transition-all duration-700 ease-out ${
          isListening || isWakeWordMode 
            ? 'bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-2xl shadow-orange-500/40 scale-110' 
            : 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 hover:from-gray-100 hover:via-gray-200 hover:to-gray-300 shadow-lg hover:shadow-xl'
        } ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
        style={{
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: isListening || isWakeWordMode 
            ? '0 20px 40px rgba(249, 115, 22, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
            : '0 10px 30px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
        }}
        title={isListening || isWakeWordMode ? 'Stop Voice Assistant' : 'Start Voice Assistant'}
      >
        {/* Glossy overlay for depth */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-white/10 to-transparent pointer-events-none" />
        
        {/* Central content */}
        <div className="relative z-10 flex items-center justify-center h-full">
          {isListening || isWakeWordMode ? (
            // Smooth animated sound wave when active
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full animate-pulse"
                  style={{
                    height: isListening 
                      ? `${Math.random() * 16 + 12}px` 
                      : `${Math.random() * 12 + 8}px`,
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '1.5s',
                    boxShadow: '0 2px 4px rgba(255, 255, 255, 0.3)'
                  }}
                />
              ))}
            </div>
          ) : (
            // Elegant microphone icon when inactive
            <svg 
              className="w-8 h-8 text-gray-500 transition-all duration-500 group-hover:text-orange-500" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}
        </div>
        
        {/* Subtle ripple effect */}
        <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
          isListening || isWakeWordMode 
            ? 'bg-orange-500/20 scale-150 opacity-0' 
            : 'bg-gray-500/20 scale-100 opacity-0'
        }`} />
        
        {/* Status indicator - minimal dot */}
        {(isListening || isWakeWordMode) && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-orange-500 shadow-lg animate-pulse" />
        )}
      </button>
    </div>
  );
}
