#!/usr/bin/env node
/**
 * Color Matching Verification Test
 * 
 * This script helps verify that the AI image generation is properly matching
 * the colors specified in the outfit recommendations.
 * 
 * Run: node scripts/verify-color-matching.js
 */

console.log('🎨 Color Matching Verification Guide\n');
console.log('=' .repeat(60));
console.log('\n📋 MANUAL TESTING CHECKLIST\n');

console.log('1. Test Color-Specific Outfits:');
console.log('   ✅ Upload photo with RED dress');
console.log('   ✅ Check recommendation includes red/burgundy/maroon in palette');
console.log('   ✅ Verify generated outfit image has RED clothing items\n');

console.log('2. Test Multi-Color Combinations:');
console.log('   ✅ Upload photo with BLUE jeans + WHITE shirt');
console.log('   ✅ Check recommendations include blue/white tones');
console.log('   ✅ Verify generated images match these colors\n');

console.log('3. Test Complementary Colors:');
console.log('   ✅ Upload photo with GREEN outfit');
console.log('   ✅ AI should recommend complementary colors');
console.log('   ✅ Generated images should reflect recommended palette\n');

console.log('4. Check AI Response Structure:');
console.log('   ✅ Open browser DevTools → Console');
console.log('   ✅ Submit style analysis');
console.log('   ✅ Look for logs:');
console.log('      - "🎨 Generating N outfit images..."');
console.log('      - "✅ Generated image with gemini-2.0..."');
console.log('      - "✅ Image loaded successfully..."\n');

console.log('5. Verify Image Generation Model:');
console.log('   ✅ Primary: gemini-2.0-flash-preview-image-generation');
console.log('   ✅ Backup: imagen-3.0-generate-001');
console.log('   ✅ Fallback: Pollinations.ai\n');

console.log('=' .repeat(60));
console.log('\n🔍 WHAT TO LOOK FOR\n');

console.log('✅ GOOD Signs (Color Matching Working):');
console.log('   • Outfit colors in image match recommended palette');
console.log('   • Consistent color theme across all recommended outfits');
console.log('   • Dress/clothing items have expected colors');
console.log('   • Color descriptions match visual appearance\n');

console.log('❌ BAD Signs (Color Matching NOT Working):');
console.log('   • Random colors not in recommendation');
console.log('   • Pollinations.ai generating wrong colors');
console.log('   • Inconsistent colors across outfits');
console.log('   • Colors don\'t match palette description\n');

console.log('=' .repeat(60));
console.log('\n🛠️ TROUBLESHOOTING\n');

console.log('If colors don\'t match:');
console.log('1. Check which model generated the image:');
console.log('   • Look for "Generated image with <model>" in console');
console.log('   • If Pollinations.ai → API quota exhausted\n');

console.log('2. Verify Gemini API keys:');
console.log('   • Check .env.local for GOOGLE_GEMINI_API_KEY');
console.log('   • Check .env.local for GOOGLE_GEMINI_API_KEY_BACKUP');
console.log('   • Run: npm run check-apis\n');

console.log('3. Check API quota:');
console.log('   • Gemini Free Tier: 100 requests/day (split between 2 keys)');
console.log('   • Look for "Available API quota: N requests" in logs');
console.log('   • If quota = 0 → wait for reset or upgrade plan\n');

console.log('4. Verify prompt configuration:');
console.log('   • File: src/ai/flows/generate-outfit-image.ts');
console.log('   • Line ~77: Should have "IMPORTANT: Match exact colors"');
console.log('   • Line ~103: responseMimeType should be "image/jpeg"\n');

console.log('=' .repeat(60));
console.log('\n📊 EXAMPLE TEST CASE\n');

console.log('Input:');
console.log('  • User uploads photo: Red dress + brown belt');
console.log('  • Occasion: Casual party');
console.log('  • Weather: Sunny, 25°C\n');

console.log('Expected Output:');
console.log('  • AI Recommendation:');
console.log('    - Suggested colors: Red, burgundy, rose, cream');
console.log('    - Outfit 1: "Red cocktail dress with gold accessories"');
console.log('    - Outfit 2: "Burgundy blazer with cream blouse"\n');

console.log('  • Generated Images:');
console.log('    ✅ Image 1 should show RED dress (not blue, green, etc.)');
console.log('    ✅ Image 2 should show BURGUNDY blazer');
console.log('    ✅ Both images should have items matching color palette\n');

console.log('=' .repeat(60));
console.log('\n🔗 RELATED FILES\n');

console.log('1. Image Generation:');
console.log('   📄 src/ai/flows/generate-outfit-image.ts');
console.log('   📄 src/lib/multi-gemini-client.ts');
console.log('   📄 src/lib/pollinations-client.ts\n');

console.log('2. Style Analysis:');
console.log('   📄 src/ai/flows/analyze-image-and-provide-recommendations.ts');
console.log('   📄 src/ai/flows/analyze-style-preferences.ts\n');

console.log('3. UI Components:');
console.log('   📄 src/components/style-advisor.tsx');
console.log('   📄 src/components/style-advisor-results.tsx\n');

console.log('=' .repeat(60));
console.log('\n✨ QUICK VERIFICATION STEPS\n');

console.log('1. Start development server:');
console.log('   $ npm run dev\n');

console.log('2. Open application:');
console.log('   → http://localhost:3000/style-check\n');

console.log('3. Test with color-specific photo:');
console.log('   • Upload photo with DISTINCT color (e.g., bright red dress)');
console.log('   • Fill form (occasion, weather, etc.)');
console.log('   • Submit and wait for results\n');

console.log('4. Verify in browser console:');
console.log('   • Open DevTools (F12 or Cmd+Option+I)');
console.log('   • Go to Console tab');
console.log('   • Look for image generation logs\n');

console.log('5. Check results visually:');
console.log('   • Do outfit images have the same colors as recommendation?');
console.log('   • Does color palette match dress colors in images?');
console.log('   • Are colors accurate and professional-looking?\n');

console.log('=' .repeat(60));
console.log('\n📝 LOGGING EXAMPLES\n');

console.log('✅ SUCCESS - Color matching working:');
console.log(`
🎨 Generating 3 outfit images...
🎯 Primary model: gemini-2.0-flash-preview-image-generation
🔑 Available API quota: 85 requests
🔄 Trying gemini-2.0-flash-preview-image-generation with Primary Key...
✅ Generated image with gemini-2.0-flash-preview-image-generation using Primary Key
✅ Image loaded successfully: data:image/jpeg;base64,/9j/4AAQSkZ...
`);

console.log('\n❌ FAILURE - Falling back to Pollinations:');
console.log(`
🎨 Generating 3 outfit images...
🎯 Primary model: gemini-2.0-flash-preview-image-generation
🔑 Available API quota: 0 requests
⚠️ No API keys available, skipping to Pollinations.ai
🔄 Trying Pollinations.ai fallback...
✅ Using Pollinations.ai (unlimited free API)
✅ Image loaded successfully: https://pollinations.ai/p/...
`);

console.log('\n=' .repeat(60));
console.log('\n💡 TIP: If using Pollinations.ai fallback, colors may not match');
console.log('   → Solution: Wait for Gemini API quota reset or upgrade plan\n');

console.log('=' .repeat(60));
console.log('\n🚀 Ready to test? Run the app and start verifying!\n');
console.log('   $ npm run dev');
console.log('   → Open http://localhost:3000/style-check\n');

console.log('📚 For more details, see:');
console.log('   • IMAGE_LOADING_IMPROVEMENTS.md');
console.log('   • API_STATUS_REPORT.md');
console.log('   • CRITICAL_FIXES.md\n');

console.log('=' .repeat(60));
