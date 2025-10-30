// Quick script to get Requests DB schema
require('dotenv').config();
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function getSchema() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: { ...process.env }
  });

  const client = new Client({ name: 'schema-checker', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  console.log('🔍 Retrieving Requests Database schema...\n');
  
  const result = await client.callTool({
    name: 'API-retrieve-a-database',
    arguments: { database_id: process.env.REQUESTS_DB_ID }
  });

  const db = JSON.parse(result.content[0].text);
  
  console.log('📊 PROPERTY NAMES IN REQUESTS DB:\n');
  Object.keys(db.properties).forEach(propName => {
    const prop = db.properties[propName];
    console.log(`  • "${propName}" (${prop.type})`);
  });
  
  await client.close();
  process.exit(0);
}

getSchema().catch(console.error);


