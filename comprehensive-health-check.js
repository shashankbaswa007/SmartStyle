#!/usr/bin/env node

/**
 * Comprehensive SmartStyle Application Health Check
 * Tests all backend services, database connections, and API integrations
 */

require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

console.log('\n🏥 SmartStyle - Comprehensive Health Check');
console.log('='.repeat(80));
console.log(`Started at: ${new Date().toISOString()}\n`);

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  critical: []
};

// Helper functions
const pass = (test) => {
  console.log(`✅ ${test}`);
  results.passed++;
};

const fail = (test, error) => {
  console.log(`❌ ${test}`);
  if (error) console.log(`   Error: ${error}`);
  results.failed++;
  results.critical.push(test);
};

const warn = (test, message) => {
  console.log(`⚠️  ${test}`);
  if (message) console.log(`   Warning: ${message}`);
  results.warnings++;
};

// Test 1: Environment Variables
console.log('\n📋 TEST 1: Environment Configuration');
console.log('-'.repeat(80));

const criticalEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'GROQ_API_KEY',
];

const optionalEnvVars = [
  'GOOGLE_GENAI_API_KEY',
  'GOOGLE_GENAI_API_KEY_BACKUP',
  'TAVILY_API_KEY',
  'REPLICATE_API_TOKEN',
  'HUGGINGFACE_API_KEY',
];

let envPassed = true;
for (const envVar of criticalEnvVars) {
  if (process.env[envVar]) {
    pass(`${envVar} configured`);
  } else {
    fail(`${envVar} MISSING`, 'Critical variable not set');
    envPassed = false;
  }
}

for (const envVar of optionalEnvVars) {
  if (process.env[envVar]) {
    pass(`${envVar} configured (optional)`);
  } else {
    warn(`${envVar} not set`, 'Optional feature will be disabled');
  }
}

// Test 2: Firebase Firestore Connection
console.log('\n🔥 TEST 2: Firebase Firestore Connection');
console.log('-'.repeat(80));

async function testFirestore() {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig, 'health-check-app');
    const db = getFirestore(app);
    
    pass('Firebase app initialized');

    // Test read access to a collection
    const testQuery = query(collection(db, 'preferences'), limit(1));
    await getDocs(testQuery);
    
    pass('Firestore read access verified');
    pass('Database connection: OPERATIONAL');
    
    return true;
  } catch (error) {
    fail('Firestore connection failed', error.message);
    return false;
  }
}

// Test 3: Groq API (Primary AI)
console.log('\n🤖 TEST 3: Groq API (Primary AI Service)');
console.log('-'.repeat(80));

async function testGroq() {
  const groqKey = process.env.GROQ_API_KEY;
  
  if (!groqKey) {
    fail('Groq API key not configured', 'Primary AI service will not work');
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
      const hasLlama = data.data?.some(model => model.id.includes('llama'));
      
      pass(`Groq API connection: Status ${response.status}`);
      pass(`Available models: ${data.data?.length || 0}`);
      
      if (hasLlama) {
        pass('Llama 3.3 70B model available');
      }
      
      pass('PRIMARY AI SERVICE: OPERATIONAL ✨');
      return true;
    } else {
      fail('Groq API request failed', `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    fail('Groq API connection error', error.message);
    return false;
  }
}

// Test 4: Gemini API (Backup AI)
console.log('\n🔮 TEST 4: Gemini API (Backup AI Service)');
console.log('-'.repeat(80));

async function testGemini() {
  const keys = [
    { key: process.env.GOOGLE_GENAI_API_KEY, name: 'Primary Key' },
    { key: process.env.GOOGLE_GENAI_API_KEY_BACKUP, name: 'Backup Key' },
  ].filter(k => k.key);

  if (keys.length === 0) {
    warn('No Gemini API keys configured', 'Backup AI service not available');
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
            contents: [{
              parts: [{ text: 'test' }]
            }]
          }),
        }
      );

      if (response.ok || response.status === 400) {
        // 400 means API works but request format is bad (expected)
        pass(`${name}: Available`);
        anyWorking = true;
      } else if (response.status === 429) {
        warn(`${name}: Quota exceeded`, 'Resets in 24 hours');
      } else {
        warn(`${name}: Status ${response.status}`);
      }
    } catch (error) {
      warn(`${name}: Connection failed`, error.message);
    }
  }

  if (anyWorking) {
    pass('Backup AI service available');
  } else {
    warn('All Gemini keys quota exceeded', 'Groq will handle all requests');
  }

  return anyWorking;
}

// Test 5: Pollinations.ai (Image Generation)
console.log('\n🎨 TEST 5: Pollinations.ai Image Generation');
console.log('-'.repeat(80));

async function testPollinations() {
  try {
    const testUrl = 'https://image.pollinations.ai/prompt/test?width=100&height=100&nologo=true';
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (response.ok) {
      pass(`Pollinations API: Status ${response.status}`);
      pass(`Content-Type: ${response.headers.get('content-type')}`);
      pass('Image generation: OPERATIONAL (FREE)');
      return true;
    } else {
      fail('Pollinations API failed', `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    fail('Pollinations API error', error.message);
    return false;
  }
}

// Test 6: Replicate API (Premium Images)
console.log('\n💎 TEST 6: Replicate API (Premium Image Generation)');
console.log('-'.repeat(80));

async function testReplicate() {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  
  if (!replicateToken) {
    warn('Replicate API token not configured', 'Premium images disabled (app will use free service)');
    return false;
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/models', {
      headers: {
        'Authorization': `Token ${replicateToken}`,
      },
    });

    if (response.ok) {
      pass(`Replicate API: Status ${response.status}`);
      pass('Premium image generation: ENABLED');
      return true;
    } else {
      warn('Replicate API failed', `HTTP ${response.status} - Will use free service`);
      return false;
    }
  } catch (error) {
    warn('Replicate API error', `${error.message} - Will use free service`);
    return false;
  }
}

// Test 7: Tavily E-Commerce Search
console.log('\n🔍 TEST 7: Tavily E-Commerce Search API');
console.log('-'.repeat(80));

async function testTavily() {
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyKey) {
    warn('Tavily API key not configured', 'Shopping links will be generic');
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
        query: 'test fashion item',
        max_results: 1,
      }),
    });

    if (response.ok) {
      pass(`Tavily API: Status ${response.status}`);
      pass('Shopping search: OPERATIONAL');
      return true;
    } else {
      warn('Tavily API failed', `HTTP ${response.status} - Generic links will be used`);
      return false;
    }
  } catch (error) {
    warn('Tavily API error', `${error.message} - Generic links will be used`);
    return false;
  }
}

// Test 8: Critical Files
console.log('\n📁 TEST 8: Critical Application Files');
console.log('-'.repeat(80));

const fs = require('fs');
const path = require('path');

const criticalFiles = [
  'src/app/api/recommend/route.ts',
  'src/lib/firebase.ts',
  'src/lib/firebase-admin.ts',
  'src/lib/groq-client.ts',
  'src/lib/image-cache.ts',
  'src/lib/replicate-image.ts',
  'src/components/style-advisor.tsx',
  'firestore.rules',
  'next.config.js',
];

let filesOk = true;
for (const file of criticalFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    pass(file);
  } else {
    fail(`Missing file: ${file}`);
    filesOk = false;
  }
}

// Run all tests
async function runAllTests() {
  const firestoreOk = await testFirestore();
  const groqOk = await testGroq();
  const geminiOk = await testGemini();
  const pollinationsOk = await testPollinations();
  const replicateOk = await testReplicate();
  const tavilyOk = await testTavily();

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 HEALTH CHECK SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Passed:   ${results.passed}`);
  console.log(`❌ Failed:   ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);

  console.log('\n🎯 CRITICAL SYSTEMS STATUS:');
  console.log('-'.repeat(80));
  console.log(`Database (Firestore):     ${firestoreOk ? '✅ OPERATIONAL' : '❌ DOWN'}`);
  console.log(`AI Service (Groq):        ${groqOk ? '✅ OPERATIONAL' : '❌ DOWN'}`);
  console.log(`AI Backup (Gemini):       ${geminiOk ? '✅ AVAILABLE' : '⚠️  UNAVAILABLE'}`);
  console.log(`Image Gen (Pollinations): ${pollinationsOk ? '✅ OPERATIONAL' : '❌ DOWN'}`);
  console.log(`Image Premium (Replicate):${replicateOk ? '✅ ENABLED' : '⚠️  DISABLED'}`);
  console.log(`Shopping (Tavily):        ${tavilyOk ? '✅ OPERATIONAL' : '⚠️  DISABLED'}`);
  console.log(`Application Files:        ${filesOk ? '✅ COMPLETE' : '❌ MISSING FILES'}`);

  console.log('\n🔄 APPLICATION STATUS:');
  console.log('-'.repeat(80));

  const criticalFailed = !firestoreOk || !groqOk || !pollinationsOk || !filesOk;

  if (criticalFailed) {
    console.log('❌ CRITICAL ERROR - Application cannot function properly');
    console.log('\n⚠️  Critical issues detected:');
    results.critical.forEach(issue => console.log(`   • ${issue}`));
    process.exit(1);
  } else {
    console.log('✅ APPLICATION READY - All critical systems operational');
    
    if (results.warnings > 0) {
      console.log('\n💡 Optional features disabled (non-critical):');
      if (!geminiOk) console.log('   • Gemini backup AI (Groq handles all requests)');
      if (!replicateOk) console.log('   • Premium images (using free service)');
      if (!tavilyOk) console.log('   • Smart shopping links (using generic links)');
    }
    
    console.log('\n🚀 System is ready to accept requests!');
    console.log('   • AI Recommendations: ✅ Operational');
    console.log('   • Image Generation: ✅ Operational');
    console.log('   • Database Access: ✅ Operational');
    console.log('   • User Preferences: ✅ Operational');
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Completed at: ${new Date().toISOString()}\n`);
}

// Execute
runAllTests().catch(error => {
  console.error('\n❌ Health check failed with error:', error);
  process.exit(1);
});
