import { invokeMcpTool } from '../../../server/mcp-client';
import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const config = await invokeMcpTool('get_tts_config');
    return Response.json(config);
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await invokeMcpTool('set_tts_config', body);
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
} 