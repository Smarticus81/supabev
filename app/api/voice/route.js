import { processNlu, trainNlu } from '@/lib/nlu';
import { invoke } from '@/lib/tools';

// Train the NLU model once when the server starts
trainNlu();

export async function POST(request) {
  const { message } = await request.json();

  if (message?.type === 'transcript' && message.transcriptType === 'final') {
    const nluResult = await processNlu(message.transcript);

    const intent = nluResult.intent;
    const entities = {};
    nluResult.entities.forEach((e) => {
      entities[e.entity] = e.sourceText;
    });

    try {
      // Convert snake_case intent to camelCase tool name
      const toolName = intent.replace(/_(\w)/g, (_, p1) => p1.toUpperCase());
      const result = await invoke(toolName, entities);

      return new Response(
        JSON.stringify({
          assistant: {
            message: `Action ${intent} completed successfully. ${JSON.stringify(result)}`,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error invoking tool:', error);
      return new Response(
        JSON.stringify({
          assistant: {
            message: `Sorry, I couldn't complete that action. ${error.message}`,
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }

  // For non-final transcripts or unsupported message types, return an empty response
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
} 