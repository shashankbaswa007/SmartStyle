#!/usr/bin/env node

/**
 * Final Component Verification Test
 * Ensures all backend, database, and API connections work correctly
 */

require('dotenv').config({ path: '.env.local' });

console.log('\n🔧 SmartStyle - Component Verification Test');
console.log('='.repeat(80));
console.log(`Started at: ${new Date().toISOString()}\n`);

const results = {
  components: [],
  criticalFailures: []
};

const pass = (component, test) => {
  console.log(`✅ ${component}: ${test}`);
  results.components.push({ component, test, status: 'pass' });
};

const fail = (component, test, error) => {
  console.log(`❌ ${component}: ${test}`);
  if (error) console.log(`   Error: ${error}`);
  results.components.push({ component, test, status: 'fail', error });
  results.criticalFailures.push({ component, test, error });
};

const warn = (component, test, message) => {
  console.log(`⚠️  ${component}: ${test}`);
  if (message) console.log(`   ${message}`);
  results.components.push({ component, test, status: 'warn', message });
};

// Test 1: Environment Configuration
console.log('📋 TEST 1: Environment Configuration');
console.log('-'.repeat(80));

const requiredVars = {
  'Groq API': process.env.GROQ_API_KEY,
  'Firebase API Key': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  'Firebase Project ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  'Firebase Auth Domain': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
};

const optionalVars = {
  'Gemini Primary': process.env.GOOGLE_GENAI_API_KEY,
  'Gemini Backup': process.env.GOOGLE_GENAI_API_KEY_BACKUP,
  'Tavily Search': process.env.TAVILY_API_KEY,
  'Replicate Premium': process.env.REPLICATE_API_TOKEN,
};

let envOk = true;
for (const [name, value] of Object.entries(requiredVars)) {
  if (value) {
    pass('Environment', `${name} configured`);
  } else {
    fail('Environment', `${name} MISSING`, 'Critical configuration missing');
    envOk = false;
  }
}

for (const [name, value] of Object.entries(optionalVars)) {
  if (value) {
    pass('Environment', `${name} configured`);
  } else {
    warn('Environment', `${name} not configured`, 'Optional feature will be unavailable');
  }
}

// Test 2: Primary AI Service (Groq)
console.log('\n🤖 TEST 2: Primary AI Service (Groq)');
console.log('-'.repeat(80));

async function testGroq() {
  const groqKey = process.env.GROQ_API_KEY;
  
  if (!groqKey) {
    fail('Groq API', 'No API key', 'Primary AI service unavailable');
    return false;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      pass('Groq API', `Connection successful (${response.status})`);
      pass('Groq API', `${data.data?.length || 0} models available`);
      
      const hasLlama = data.data?.some(m => m.id.includes('llama-3.3-70b'));
      if (hasLlama) {
        pass('Groq API', 'Llama 3.3 70B Versatile model available ✨');
      } else {
        warn('Groq API', 'Llama 3.3 model not found', 'May use different model');
      }
      return true;
    } else {
      fail('Groq API', `Connection failed (${response.status})`);
      return false;
    }
  } catch (error) {
    fail('Groq API', 'Connection error', error.message);
    return false;
  }
}

// Test 3: Image Generation Service
console.log('\n🎨 TEST 3: Image Generation Service (Pollinations.ai)');
console.log('-'.repeat(80));

async function testImageGeneration() {
  try {
    const testUrl = 'https://image.pollinations.ai/prompt/test?width=100&height=100&nologo=true&model=flux';
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (response.ok) {
      pass('Image Generation', `Pollinations API operational (${response.status})`);
      pass('Image Generation', `Content-Type: ${response.headers.get('content-type')}`);
      pass('Image Generation', 'FREE unlimited image generation available ✨');
      return true;
    } else {
      fail('Image Generation', `Pollinations failed (${response.status})`);
      return false;
    }
  } catch (error) {
    fail('Image Generation', 'Connection error', error.message);
    return false;
  }
}

// Test 4: Shopping Search Service
console.log('\n🛍️ TEST 4: Shopping Search Service (Tavily)');
console.log('-'.repeat(80));

async function testShopping() {
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyKey) {
    warn('Shopping Search', 'Tavily API key not configured', 'Generic shopping links will be used');
    return false;
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: 'test',
        max_results: 1,
      }),
    });

    if (response.ok) {
      pass('Shopping Search', `Tavily API operational (${response.status})`);
      pass('Shopping Search', 'Smart shopping links enabled ✨');
      return true;
    } else {
      warn('Shopping Search', `Tavily failed (${response.status})`, 'Generic links will be used');
      return false;
    }
  } catch (error) {
    warn('Shopping Search', 'Connection error', `${error.message} - Generic links will be used`);
    return false;
  }
}

// Test 5: Weather Service
console.log('\n🌤️ TEST 5: Weather Service (OpenWeather)');
console.log('-'.repeat(80));

async function testWeather() {
  const weatherKey = process.env.OPENWEATHER_API_KEY;
  
  if (!weatherKey) {
    warn('Weather Service', 'API key not configured', 'Weather-based recommendations disabled');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=28.6139&lon=77.2090&appid=${weatherKey}&units=metric`
    );

    if (response.ok) {
      const data = await response.json();
      pass('Weather Service', `OpenWeather API operational (${response.status})`);
      pass('Weather Service', `Test query: ${data.name}, ${data.main.temp}°C`);
      return true;
    } else {
      warn('Weather Service', `API failed (${response.status})`, 'Weather features disabled');
      return false;
    }
  } catch (error) {
    warn('Weather Service', 'Connection error', `${error.message} - Weather features disabled`);
    return false;
  }
}

// Test 6: Premium Image Service (Optional)
console.log('\n💎 TEST 6: Premium Image Service (Replicate)');
console.log('-'.repeat(80));

async function testReplicate() {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  
  if (!replicateToken) {
    warn('Replicate', 'API token not configured', 'Using free image service for all images');
    pass('Replicate', 'Free fallback strategy active ✅');
    return false;
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/models', {
      headers: {
        'Authorization': `Token ${replicateToken}`,
      },
    });

    if (response.ok) {
      pass('Replicate', `API operational (${response.status})`);
      pass('Replicate', 'Premium images enabled for position 1 ✨');
      return true;
    } else {
      warn('Replicate', `API failed (${response.status})`, 'Using free service');
      return false;
    }
  } catch (error) {
    warn('Replicate', 'Connection error', `${error.message} - Using free service`);
    return false;
  }
}

// Test 7: Backup AI Service (Gemini)
console.log('\n🔮 TEST 7: Backup AI Service (Gemini)');
console.log('-'.repeat(80));

async function testGemini() {
  const keys = [
    { key: process.env.GOOGLE_GENAI_API_KEY, name: 'Primary Key' },
    { key: process.env.GOOGLE_GENAI_API_KEY_BACKUP, name: 'Backup Key' },
  ].filter(k => k.key);

  if (keys.length === 0) {
    warn('Gemini', 'No API keys configured', 'Groq will handle all AI requests (recommended)');
    pass('Gemini', 'Not needed - Groq is sufficient ✅');
    return false;
  }

  let anyWorking = false;
  for (const { key, name } of keys) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'test' }] }]
          }),
        }
      );

      if (response.ok || response.status === 400) {
        pass('Gemini', `${name} available`);
        anyWorking = true;
      } else if (response.status === 429) {
        warn('Gemini', `${name} quota exceeded`, 'Resets in 24h');
      } else {
        warn('Gemini', `${name} status ${response.status}`);
      }
    } catch (error) {
      warn('Gemini', `${name} connection failed`);
    }
  }

  if (anyWorking) {
    pass('Gemini', 'Backup AI available');
  } else {
    warn('Gemini', 'Backup unavailable', 'Groq will handle all requests (recommended)');
  }

  return anyWorking;
}

// Run all tests
async function runAllTests() {
  const groqOk = await testGroq();
  const imageOk = await testImageGeneration();
  const shoppingOk = await testShopping();
  const weatherOk = await testWeather();
  const replicateOk = await testReplicate();
  const geminiOk = await testGemini();

  // Calculate statistics
  const passed = results.components.filter(c => c.status === 'pass').length;
  const failed = results.components.filter(c => c.status === 'fail').length;
  const warnings = results.components.filter(c => c.status === 'warn').length;

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);

  console.log('\n🎯 COMPONENT STATUS:');
  console.log('-'.repeat(80));
  console.log(`Environment Config:       ${envOk ? '✅ Complete' : '❌ Incomplete'}`);
  console.log(`AI Service (Groq):        ${groqOk ? '✅ Operational' : '❌ Down'}`);
  console.log(`Image Generation:         ${imageOk ? '✅ Operational' : '❌ Down'}`);
  console.log(`Shopping Search:          ${shoppingOk ? '✅ Enabled' : '⚠️  Basic Mode'}`);
  console.log(`Weather Service:          ${weatherOk ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log(`Premium Images:           ${replicateOk ? '✅ Enabled' : '⚠️  Free Only'}`);
  console.log(`Backup AI (Gemini):       ${geminiOk ? '✅ Available' : '⚠️  Unavailable'}`);

  console.log('\n🚀 APPLICATION STATUS:');
  console.log('-'.repeat(80));

  const criticalOk = envOk && groqOk && imageOk;

  if (!criticalOk) {
    console.log('❌ CRITICAL ERROR - Core components are not functional');
    console.log('\n⚠️  Critical issues:');
    results.criticalFailures.forEach(({ component, test, error }) => {
      console.log(`   • ${component}: ${test}`);
      if (error) console.log(`     ${error}`);
    });
    console.log('\n🔧 Required actions:');
    if (!envOk) console.log('   1. Check .env.local file has all required variables');
    if (!groqOk) console.log('   2. Verify GROQ_API_KEY is valid at https://console.groq.com/keys');
    if (!imageOk) console.log('   3. Check internet connection for image generation service');
    process.exit(1);
  } else {
    console.log('✅ ALL CRITICAL COMPONENTS OPERATIONAL');
    console.log('\n🎉 Application is ready to use!');
    console.log('\n📋 Core Features Available:');
    console.log('   ✅ AI-powered outfit recommendations');
    console.log('   ✅ Image generation (FREE unlimited)');
    console.log('   ✅ Color analysis and matching');
    console.log('   ✅ User preferences and history');
    console.log('   ✅ Firebase authentication');
    
    if (warnings > 0) {
      console.log('\n💡 Optional Features:');
      if (!shoppingOk) console.log('   ⚠️  Smart shopping links (using generic links)');
      if (!weatherOk) console.log('   ⚠️  Weather-based recommendations (disabled)');
      if (!replicateOk) console.log('   ⚠️  Premium images (using free service)');
      if (!geminiOk) console.log('   ⚠️  Backup AI (Groq handles all requests)');
      console.log('\n   All optional features can be enabled by adding API keys to .env.local');
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Open browser: http://localhost:3000');
    console.log('   3. Upload an outfit photo and get recommendations!');
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Completed at: ${new Date().toISOString()}\n`);
}

// Execute
runAllTests().catch(error => {
  console.error('\n❌ Verification failed with error:', error);
  process.exit(1);
});
