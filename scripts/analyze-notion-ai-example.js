// Fetch the Notion AI example to see proper formatting
require('dotenv').config();
const MCPClient = require('../lib/mcp-client');

async function analyzeExample() {
  const mcpClient = new MCPClient({
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: { NOTION_API_KEY: process.env.NOTION_API_KEY }
  });

  try {
    await mcpClient.connect();
    
    const pageId = '2984900fe66a80fa85d9cb133640649f'; // Notion AI's recreation
    console.log(`📖 Analyzing Notion AI's beautiful example...\n`);
    
    // Fetch all blocks from the page
    let allBlocks = [];
    let hasMore = true;
    let cursor = null;
    
    while (hasMore) {
      const response = await mcpClient.callTool('API-get-block-children', {
        block_id: pageId,
        page_size: 100,
        ...(cursor && { start_cursor: cursor })
      });
      
      allBlocks = allBlocks.concat(response.results || []);
      hasMore = response.has_more;
      cursor = response.next_cursor;
    }
    
    console.log(`✅ Fetched ${allBlocks.length} total blocks\n`);
    console.log('📋 PAGE STRUCTURE:\n');
    
    // Analyze structure
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      const blockType = block.type;
      
      if (blockType === 'heading_1') {
        const text = block.heading_1.rich_text[0]?.plain_text || '';
        console.log(`\n# ${text} (H1)`);
      } else if (blockType === 'heading_2') {
        const text = block.heading_2.rich_text[0]?.plain_text || '';
        console.log(`\n## ${text} (H2)`);
      } else if (blockType === 'heading_3') {
        const text = block.heading_3.rich_text[0]?.plain_text || '';
        console.log(`   ### ${text} (H3)`);
      } else if (blockType === 'paragraph') {
        const text = block.paragraph.rich_text[0]?.plain_text || '';
        if (text.length > 80) {
          console.log(`   📝 Paragraph: "${text.substring(0, 80)}..."`);
        } else if (text.length > 0) {
          console.log(`   📝 Paragraph: "${text}"`);
        }
      } else if (blockType === 'bulleted_list_item') {
        const text = block.bulleted_list_item.rich_text[0]?.plain_text || '';
        console.log(`   • ${text}`);
      } else if (blockType === 'callout') {
        const text = block.callout.rich_text[0]?.plain_text || '';
        const emoji = block.callout.icon?.emoji || '📌';
        console.log(`   ${emoji} Callout: "${text.substring(0, 60)}..."`);
      } else if (blockType === 'toggle') {
        const text = block.toggle.rich_text[0]?.plain_text || '';
        console.log(`   🔽 Toggle: "${text}"`);
      } else if (blockType === 'divider') {
        console.log(`   ─────────────────`);
      } else {
        console.log(`   [${blockType}]`);
      }
    }
    
    // Save detailed analysis
    const fs = require('fs');
    fs.writeFileSync(
      '/Users/unothekidd/cursor_projects/velto-client-request-automation-main/notion-ai-example-blocks.json',
      JSON.stringify(allBlocks, null, 2)
    );
    
    console.log('\n✅ Detailed blocks saved to notion-ai-example-blocks.json');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeExample().catch(console.error);

