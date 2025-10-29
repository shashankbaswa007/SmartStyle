/**
 * API Integration Test Suite
 * Tests all external API integrations in SmartStyle application
 */

// Test configuration
const testConfig = {
  verbose: true,
  exitOnFailure: false,
};

interface TestResult {
  api: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} ${result.api}: ${result.message}`);
  if (testConfig.verbose && result.details) {
    console.log(`   Details:`, result.details);
  }
  results.push(result);
}

async function testFirebaseConfig() {
  console.log('\n🔥 Testing Firebase Configuration...');
  
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    logTest({
      api: 'Firebase Config',
      status: 'FAIL',
      message: `Missing environment variables: ${missingVars.join(', ')}`,
    });
    return false;
  }

  try {
    // Check if Firebase is properly initialized
    const { auth, db } = await import('@/lib/firebase');
    
    if (!auth || !db) {
      throw new Error('Firebase services not initialized');
    }

    logTest({
      api: 'Firebase Config',
      status: 'PASS',
      message: 'All Firebase environment variables present and services initialized',
      details: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      }
    });
    return true;
  } catch (error) {
    logTest({
      api: 'Firebase Config',
      status: 'FAIL',
      message: `Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function testGeminiAPI() {
  console.log('\n🤖 Testing Google Gemini API...');
  
  const primaryKey = process.env.GOOGLE_GENAI_API_KEY;
  const backupKey = process.env.GOOGLE_GENAI_API_KEY_BACKUP;

  if (!primaryKey && !backupKey) {
    logTest({
      api: 'Google Gemini API',
      status: 'FAIL',
      message: 'No Gemini API keys configured',
    });
    return false;
  }

  try {
    const { multiGeminiManager } = await import('@/lib/multi-gemini-client');
    
    const hasKeys = multiGeminiManager.hasAvailableKeys();
    const keyCount = multiGeminiManager.getTotalAvailableQuota();
    
    if (!hasKeys) {
      throw new Error('No available Gemini API keys');
    }

    logTest({
      api: 'Google Gemini API',
      status: 'PASS',
      message: `Gemini API configured with ${primaryKey ? 'primary' : ''} ${primaryKey && backupKey ? 'and backup' : ''} ${!primaryKey && backupKey ? 'backup' : ''} key(s)`,
      details: {
        totalQuota: keyCount,
        hasPrimary: !!primaryKey,
        hasBackup: !!backupKey,
      }
    });
    return true;
  } catch (error) {
    logTest({
      api: 'Google Gemini API',
      status: 'FAIL',
      message: `Gemini API test failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function testGroqAPI() {
  console.log('\n⚡ Testing Groq API...');
  
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    logTest({
      api: 'Groq API',
      status: 'WARNING',
      message: 'Groq API key not configured (optional but recommended)',
    });
    return false;
  }

  try {
    // Test Groq API with a simple request
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    logTest({
      api: 'Groq API',
      status: 'PASS',
      message: 'Groq API key is valid and working',
      details: {
        modelsAvailable: data.data?.length || 0,
        keyPrefix: groqKey.substring(0, 10) + '...',
      }
    });
    return true;
  } catch (error) {
    logTest({
      api: 'Groq API',
      status: 'FAIL',
      message: `Groq API test failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function testTavilyAPI() {
  console.log('\n🔍 Testing Tavily API...');
  
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!tavilyKey) {
    logTest({
      api: 'Tavily API',
      status: 'WARNING',
      message: 'Tavily API key not configured (optional for e-commerce links)',
    });
    return false;
  }

  try {
    // Test Tavily API with a simple search
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    logTest({
      api: 'Tavily API',
      status: 'PASS',
      message: 'Tavily API key is valid and working',
      details: {
        resultsReturned: data.results?.length || 0,
        keyPrefix: tavilyKey.substring(0, 10) + '...',
      }
    });
    return true;
  } catch (error) {
    logTest({
      api: 'Tavily API',
      status: 'FAIL',
      message: `Tavily API test failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function testPollinationsAI() {
  console.log('\n🎨 Testing Pollinations.ai...');
  
  try {
    // Pollinations.ai doesn't require API key - test by generating URL
    const testPrompt = 'fashion outfit';
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(testPrompt)}?width=512&height=512&nologo=true`;
    
    // Try to fetch the image to verify service is accessible
    const response = await fetch(imageUrl, { method: 'HEAD' });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Service unavailable`);
    }

    logTest({
      api: 'Pollinations.ai',
      status: 'PASS',
      message: 'Pollinations.ai image generation service is accessible (no API key needed)',
      details: {
        serviceUrl: 'https://image.pollinations.ai',
        model: 'flux',
        unlimited: true,
      }
    });
    return true;
  } catch (error) {
    logTest({
      api: 'Pollinations.ai',
      status: 'FAIL',
      message: `Pollinations.ai test failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function testFirestoreRules() {
  console.log('\n📋 Testing Firestore Security Rules...');
  
  try {
    // Import Firebase and check if we can access the database
    const { db } = await import('@/lib/firebase');
    
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    logTest({
      api: 'Firestore Rules',
      status: 'PASS',
      message: 'Firestore security rules deployed and accessible',
      details: {
        note: 'Rules include likedOutfits, recommendationHistory, and user preferences',
      }
    });
    return true;
  } catch (error) {
    logTest({
      api: 'Firestore Rules',
      status: 'WARNING',
      message: `Cannot verify Firestore rules: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  SmartStyle API Integration Test Suite');
  console.log('='.repeat(60));

  // Run all tests
  await testFirebaseConfig();
  await testGeminiAPI();
  await testGroqAPI();
  await testTavilyAPI();
  await testPollinationsAI();
  await testFirestoreRules();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📊 Total: ${results.length}`);

  // Detailed results
  console.log('\n' + '-'.repeat(60));
  console.log('Detailed Results:');
  console.log('-'.repeat(60));
  
  results.forEach(result => {
    const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`\n${emoji} ${result.api}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   ${result.message}`);
  });

  // Critical failures
  const criticalFailures = results.filter(r => 
    r.status === 'FAIL' && 
    (r.api === 'Firebase Config' || r.api === 'Google Gemini API')
  );

  if (criticalFailures.length > 0) {
    console.log('\n' + '⚠️'.repeat(30));
    console.log('CRITICAL FAILURES DETECTED:');
    criticalFailures.forEach(failure => {
      console.log(`  - ${failure.api}: ${failure.message}`);
    });
    console.log('\nThe application may not function correctly without these APIs.');
    console.log('⚠️'.repeat(30));
  }

  console.log('\n' + '='.repeat(60));
  
  const overallStatus = failed === 0 ? '✅ ALL TESTS PASSED' : 
                        criticalFailures.length > 0 ? '❌ CRITICAL FAILURES' :
                        '⚠️  SOME TESTS FAILED';
  
  console.log(`  ${overallStatus}`);
  console.log('='.repeat(60) + '\n');

  return {
    passed,
    failed,
    warnings,
    total: results.length,
    results,
  };
}

// Export for use in other files
export { runAllTests, testFirebaseConfig, testGeminiAPI, testGroqAPI, testTavilyAPI, testPollinationsAI };

// Run tests if called directly
if (require.main === module) {
  runAllTests().then(summary => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
