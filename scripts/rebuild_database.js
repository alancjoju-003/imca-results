const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Rebuilding IMCA database using BeautifulSoup parser (analyze_data.py)...');
try {
  execSync('uv run --with beautifulsoup4 python analyze_data.py', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('🔄 Regenerating frontend json bundles (prepare_data.js)...');
  execSync('node scripts/prepare_data.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('✅ Rebuild completed successfully!');
} catch (err) {
  console.error('❌ Error during database rebuild:', err.message);
  process.exit(1);
}
