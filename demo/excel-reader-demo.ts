import { ExcelReader } from '../src/ExcelReader.js';
import * as path from 'path';

async function demo() {
  console.log('🔍 Excel Reader Demo\n');

  // Demo with ListenFirst file
  const listenFirstFile = path.join(process.cwd(), 'data', 'Listenfirst database', 'ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx');
  
  console.log('📁 Loading ListenFirst file...');
  const reader = new ExcelReader(listenFirstFile);
  await reader.load();

  // Get file info
  const info = reader.getFileInfo();
  console.log(`📊 File: ${path.basename(info.filePath)}`);
  console.log(`📋 Sheets: ${info.sheetCount}`);
  console.log(`📝 Sheet names: ${info.sheets.join(', ')}\n`);

  // Get first sheet data
  const firstSheet = info.sheets[0];
  console.log(`📄 First sheet: "${firstSheet}"`);
  
  // Show first 10 rows
  const data = reader.getRawData(firstSheet, 10);
  console.log(`\n📈 First 10 rows:`);
  data.forEach((row, index) => {
    console.log(`Row ${index + 1}: [${row.slice(0, 5).join(', ')}${row.length > 5 ? '...' : ''}]`);
  });

  // Demo parser configuration
  console.log('\n🔧 Configuring parser for structured data...');
  reader.configureParser({
    metadataRows: 3,
    headerRow: 4,
    dataStartRow: 5
  });

  const parsed = reader.getParsedData(firstSheet, 5);
  console.log(`\n📋 Metadata rows (${parsed.metadata.length}):`);
  parsed.metadata.forEach((row, index) => {
    console.log(`  ${index + 1}: [${row.slice(0, 3).join(', ')}${row.length > 3 ? '...' : ''}]`);
  });

  console.log(`\n🏷️  Headers (${parsed.headers.length}):`);
  console.log(`  [${parsed.headers.slice(0, 5).join(', ')}${parsed.headers.length > 5 ? '...' : ''}]`);

  console.log(`\n📊 Data rows (${parsed.data.length}):`);
  parsed.data.forEach((row, index) => {
    console.log(`  ${index + 1}: [${row.slice(0, 3).join(', ')}${row.length > 3 ? '...' : ''}]`);
  });

  console.log('\n✅ Demo completed successfully!');
}

// Run the demo
demo().catch(console.error);
