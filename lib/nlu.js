const { NlpManager } = require('node-nlp');
const fs = require('fs');
const path = require('path');

let manager;

async function trainNlu() {
  manager = new NlpManager({ languages: ['en'], forceNER: true, nlu: { log: false } });

  const intentsPath = path.join(process.cwd(), 'data', 'intents.json');
  const intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));

  for (const intent of intentsData.intents) {
    for (const pattern of intent.patterns) {
      manager.addDocument('en', pattern, intent.intent);
    }
  }
  
  // To-do: Add entity extraction from a 'drinks' database source.
  
  console.log('Training NLU model...');
  await manager.train();
  console.log('NLU model trained.');
  
  return manager;
}

function getNluManager() {
  if (!manager) {
    throw new Error('NLU manager not trained. Call trainNlu() first.');
  }
  return manager;
}

async function processNlu(text) {
  const localManager = getNluManager();
  return localManager.process('en', text);
}

module.exports = { trainNlu, getNluManager, processNlu }; 