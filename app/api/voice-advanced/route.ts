import { NextRequest, NextResponse } from 'next/server';
import { invokeMcpToolDirect } from '../../../lib/mcp-direct';

// Premium OpenAI WebRTC Voice API - Single Consolidated Endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body;

    if (!tool) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tool name is required' 
      }, { status: 400 });
    }

    console.log('🎤 OpenAI WebRTC Voice API - Invoking tool:', tool, 'with parameters:', parameters);
    
    // Ensure consistent clientId is always provided for voice operations
    const enhancedParameters = {
      ...parameters,
      clientId: parameters?.clientId || 'voice_default'
    };
    
    // Call MCP Direct for ultra-low latency (works on Vercel)
    const result = await invokeMcpToolDirect(tool, enhancedParameters);
    
    // Enhanced response formatting for voice operations
    const response = {
      success: true,
      result: result,
      timestamp: Date.now(),
      latency: 'ultra_low',
      voice_provider: 'openai_webrtc'
    };
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in OpenAI WebRTC Voice API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      voice_provider: 'openai_webrtc'
    }, { status: 500 });
  }
}

// Health check endpoint for voice system
export async function GET(request: NextRequest) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      status: 'healthy',
      voice_provider: 'openai_webrtc',
      features: [
        'real_time_conversation',
        'wake_word_detection', 
        'cart_management',
        'inventory_operations',
        'ultra_low_latency'
      ],
      api_key_configured: !!openaiKey && openaiKey !== 'your-openai-api-key-here',
      timestamp: Date.now()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { status: 500 });
  }
}
