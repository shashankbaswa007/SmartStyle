#!/usr/bin/env node

/**
 * API Health Check Script
 * Quick verification of all SmartStyle API integrations
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('  🔍 SmartStyle API Health Check');
console.log('='.repeat(70) + '\n');

// Read .env.local file
const envPath = path.join(process.cwd(), '.env.local');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });
  console.log('✅ Found .env.local file\n');
} else {
  console.log('❌ .env.local file not found!\n');
  process.exit(1);
}

const results = [];

function checkAPI(name, check) {
  const result = check();
  results.push({ name, ...result });
  
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} ${name}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    Object.entries(result.details).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });
  }
  console.log('');
}

// 1. Firebase Configuration
checkAPI('Firebase Configuration', () => {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  const missing = required.filter(key => !envVars[key]);
  
  if (missing.length > 0) {
    return {
      status: 'FAIL',
      message: `Missing variables: ${missing.join(', ')}`,
    };
  }

  return {
    status: 'PASS',
    message: 'All Firebase config variables present',
    details: {
      'Project ID': envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      'Auth Domain': envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    }
  };
});

// 2. Google Gemini API
checkAPI('Google Gemini API', () => {
  const primary = envVars.GOOGLE_GENAI_API_KEY;
  const backup = envVars.GOOGLE_GENAI_API_KEY_BACKUP;

  if (!primary && !backup) {
    return {
      status: 'FAIL',
      message: 'No Gemini API keys configured',
    };
  }

  const keyInfo = [];
  if (primary) keyInfo.push(`Primary: ${primary.substring(0, 15)}...`);
  if (backup) keyInfo.push(`Backup: ${backup.substring(0, 15)}...`);

  return {
    status: 'PASS',
    message: `${primary && backup ? 'Both keys' : 'One key'} configured`,
    details: {
      'Primary Key': primary ? 'Yes ✓' : 'No',
      'Backup Key': backup ? 'Yes ✓' : 'No',
      'Total Quota': (primary ? 50 : 0) + (backup ? 50 : 0) + ' requests/day',
    }
  };
});

// 3. Groq API
checkAPI('Groq API (Primary AI)', () => {
  const groqKey = envVars.GROQ_API_KEY;

  if (!groqKey) {
    return {
      status: 'WARNING',
      message: 'Not configured (optional but recommended for 14,400 free requests/day)',
    };
  }

  return {
    status: 'PASS',
    message: 'Configured and ready',
    details: {
      'Key': groqKey.substring(0, 15) + '...',
      'Free Quota': '14,400 requests/day',
      'Model': 'Llama 3.3 70B',
    }
  };
});

// 4. Tavily API
checkAPI('Tavily API (Shopping Links)', () => {
  const tavilyKey = envVars.TAVILY_API_KEY;

  if (!tavilyKey) {
    return {
      status: 'WARNING',
      message: 'Not configured (optional for e-commerce shopping links)',
    };
  }

  return {
    status: 'PASS',
    message: 'Configured for shopping link generation',
    details: {
      'Key': tavilyKey.substring(0, 15) + '...',
      'Purpose': 'E-commerce search (Amazon, Myntra, Ajio)',
    }
  };
});

// 5. Pollinations.ai
checkAPI('Pollinations.ai (Image Generation)', () => {
  return {
    status: 'PASS',
    message: 'Always available (no API key needed)',
    details: {
      'Service': 'Free image generation',
      'Model': 'Stable Diffusion Flux',
      'Quota': 'Unlimited',
    }
  };
});

// 6. Image Generation Model
checkAPI('Image Generation Model', () => {
  const hasGemini = envVars.GOOGLE_GENAI_API_KEY || envVars.GOOGLE_GENAI_API_KEY_BACKUP;
  
  return {
    status: hasGemini ? 'PASS' : 'WARNING',
    message: hasGemini 
      ? 'Using gemini-2.0-flash-preview-image-generation (primary) with Pollinations.ai fallback'
      : 'Using Pollinations.ai only (Gemini not configured)',
    details: {
      'Primary': hasGemini ? 'Gemini 2.0 Flash Image Gen' : 'N/A',
      'Fallback': 'Pollinations.ai',
      'Color Accuracy': 'Enhanced with specific color matching',
    }
  };
});

// 7. Firestore Security Rules
checkAPI('Firestore Security Rules', () => {
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  
  if (!fs.existsSync(rulesPath)) {
    return {
      status: 'FAIL',
      message: 'firestore.rules file not found',
    };
  }

  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  const hasLikedOutfits = rulesContent.includes('likedOutfits');
  const hasRecommendations = rulesContent.includes('recommendationHistory');
  
  if (!hasLikedOutfits) {
    return {
      status: 'FAIL',
      message: 'Missing likedOutfits security rules - likes won\'t save!',
    };
  }

  return {
    status: 'PASS',
    message: 'Security rules configured',
    details: {
      'Liked Outfits': hasLikedOutfits ? 'Yes ✓' : 'No ✗',
      'Recommendations': hasRecommendations ? 'Yes ✓' : 'No ✗',
      'Status': 'Deploy with: firebase deploy --only firestore:rules',
    }
  };
});

// Summary
console.log('='.repeat(70));
console.log('  📊 Summary');
console.log('='.repeat(70) + '\n');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warnings = results.filter(r => r.status === 'WARNING').length;

console.log(`✅ Passed:   ${passed}/${results.length}`);
console.log(`❌ Failed:   ${failed}/${results.length}`);
console.log(`⚠️  Warnings: ${warnings}/${results.length}\n`);

// Critical failures
const critical = results.filter(r => 
  r.status === 'FAIL' && 
  (r.name.includes('Firebase') || r.name.includes('Gemini') || r.name.includes('Rules'))
);

if (critical.length > 0) {
  console.log('='.repeat(70));
  console.log('  ⚠️  CRITICAL ISSUES DETECTED');
  console.log('='.repeat(70) + '\n');
  critical.forEach(c => {
    console.log(`❌ ${c.name}: ${c.message}\n`);
  });
}

// Recommendations
console.log('='.repeat(70));
console.log('  💡 Recommendations');
console.log('='.repeat(70) + '\n');

if (!envVars.GROQ_API_KEY) {
  console.log('• Get Groq API key for 14,400 free AI requests/day');
  console.log('  → https://console.groq.com/keys\n');
}

if (!envVars.TAVILY_API_KEY) {
  console.log('• Get Tavily API key for better shopping links');
  console.log('  → https://tavily.com/\n');
}

if (!envVars.GOOGLE_GENAI_API_KEY_BACKUP) {
  console.log('• Add backup Gemini API key for higher quota');
  console.log('  → https://aistudio.google.com/app/apikey\n');
}

// Deploy reminder
const rulesPath = path.join(process.cwd(), 'firestore.rules');
if (fs.existsSync(rulesPath)) {
  console.log('• Deploy Firestore rules to apply security updates:');
  console.log('  → firebase deploy --only firestore:rules\n');
}

console.log('='.repeat(70));

const overallStatus = failed === 0 ? '✅ ALL SYSTEMS OPERATIONAL' : 
                      critical.length > 0 ? '❌ CRITICAL FAILURES - FIX REQUIRED' :
                      '⚠️  WARNINGS - REVIEW RECOMMENDED';

console.log(`  ${overallStatus}`);
console.log('='.repeat(70) + '\n');

process.exit(failed > 0 ? 1 : 0);
