import { invokeMcpTool } from '../../../server/mcp-client';
import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const config = await invokeMcpTool('get_tts_config');
    const fullConfig = {
      ...config,
      openaiKey: process.env.OPENAI_API_KEY || null,
      elevenlabsKey: process.env.ELEVENLABS_API_KEY || null,
      deepgramKey: process.env.DEEPGRAM_API_KEY || null,
      humeKey: process.env.HUME_API_KEY || null,
      rimeKey: process.env.RIME_API_KEY || null,
    };
    return Response.json(fullConfig);
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle different configuration types
    if (body.tts_provider && body.tts_voice) {
      // TTS provider configuration
      const result = await invokeMcpTool('set_tts_config', {
        tts_provider: body.tts_provider,
        tts_voice: body.tts_voice,
        rate: body.rate,
        temperature: body.temperature
      });
      return Response.json(result);
    } else if (body.voice) {
      // OpenAI voice configuration (legacy support)
      const result = await invokeMcpTool('set_tts_config', {
        tts_provider: 'openai',
        tts_voice: body.voice,
        rate: body.rate,
        temperature: body.temperature
      });
      return Response.json(result);
    } else {
      return Response.json({ error: 'Invalid configuration data' }, { status: 400 });
    }
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
} 