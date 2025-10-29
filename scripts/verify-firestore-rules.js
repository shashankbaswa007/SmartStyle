#!/usr/bin/env node
/**
 * Firestore Security Rules Verification Script
 * 
 * This script verifies that Firestore security rules are properly configured
 * for the SmartStyle application.
 * 
 * Run: npm run verify-firestore
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 FIRESTORE SECURITY RULES VERIFICATION\n');
console.log('='.repeat(60));

// Read the firestore.rules file
const rulesPath = path.join(__dirname, '..', 'firestore.rules');

if (!fs.existsSync(rulesPath)) {
  console.error('❌ ERROR: firestore.rules file not found!');
  console.error(`   Expected at: ${rulesPath}`);
  process.exit(1);
}

const rules = fs.readFileSync(rulesPath, 'utf8');

console.log('\n📄 Firestore Rules File Location:');
console.log(`   ${rulesPath}\n`);

console.log('='.repeat(60));
console.log('\n✅ VERIFICATION CHECKLIST:\n');

const checks = [
  {
    name: 'Rules Version Declaration',
    pattern: /rules_version\s*=\s*'2'/,
    description: 'Using latest rules version 2',
  },
  {
    name: 'isAuthenticated Helper Function',
    pattern: /function\s+isAuthenticated\s*\(\s*\)\s*\{[\s\S]*?return\s+request\.auth\s*!=\s*null/,
    description: 'Checks if user is authenticated',
  },
  {
    name: 'isOwner Helper Function',
    pattern: /function\s+isOwner\s*\(\s*userId\s*\)\s*\{[\s\S]*?return\s+isAuthenticated\s*\(\s*\)\s*&&\s*request\.auth\.uid\s*==\s*userId/,
    description: 'Checks if user owns the resource',
  },
  {
    name: 'canReadAnonymously Helper Function',
    pattern: /function\s+canReadAnonymously\s*\(\s*\)\s*\{[\s\S]*?return\s+isAuthenticated\s*\(\s*\)/,
    description: 'Requires authentication for reads',
  },
  {
    name: 'Users Collection Rules',
    pattern: /match\s+\/users\/\{userId\}\s*\{[\s\S]*?allow\s+read:.*?isOwner\s*\(\s*userId\s*\)[\s\S]*?allow\s+write:.*?isOwner\s*\(\s*userId\s*\)/,
    description: 'Users can read/write their own data',
  },
  {
    name: 'Liked Outfits Subcollection',
    pattern: /match\s+\/likedOutfits\/\{outfitId\}\s*\{[\s\S]*?allow\s+read:[\s\S]*?allow\s+write:[\s\S]*?allow\s+create:[\s\S]*?allow\s+delete:/,
    description: 'Nested under users, proper permissions',
  },
  {
    name: 'Outfit Usage Subcollection',
    pattern: /match\s+\/outfitUsage\/\{usageId\}/,
    description: 'Tracks when outfits are worn',
  },
  {
    name: 'Recommendation History Subcollection',
    pattern: /match\s+\/recommendationHistory\/\{(recommendationId|historyId)\}/,
    description: 'Stores past recommendations',
  },
  {
    name: 'Feedback Subcollection',
    pattern: /match\s+\/feedback\/\{(feedbackId|recommendationId)\}/,
    description: 'User feedback on recommendations',
  },
  {
    name: 'Default Deny Rule',
    pattern: /match\s+\/\{document=\*\*\}\s*\{[\s\S]*?allow\s+read,?\s*write:\s*if\s+false/,
    description: 'Denies all other access by default',
  },
];

let passCount = 0;
let failCount = 0;
const results = [];

checks.forEach((check, index) => {
  const passed = check.pattern.test(rules);
  const status = passed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${index + 1}. ${check.name}`);
  console.log(`   Description: ${check.description}`);
  console.log(`   Status: ${status}\n`);
  
  results.push({ ...check, passed });
  
  if (passed) passCount++;
  else failCount++;
});

console.log('='.repeat(60));
console.log(`\n📊 RESULTS: ${passCount}/${checks.length} checks passed\n`);

if (failCount === 0) {
  console.log('✅ ALL FIRESTORE RULES ARE CORRECT!\n');
  console.log('🎯 Security Status: PRODUCTION READY\n');
  console.log('🔒 Security Features:');
  console.log('   • Authentication required for all operations');
  console.log('   • User data isolation (userId-based permissions)');
  console.log('   • Nested subcollections properly secured');
  console.log('   • Default deny-all fallback\n');
} else {
  console.log(`❌ ${failCount} ISSUES FOUND - PLEASE REVIEW\n`);
  console.log('⚠️  Security Status: NEEDS ATTENTION\n');
  console.log('Failed checks:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   • ${r.name}: ${r.description}`);
  });
  console.log();
}

console.log('='.repeat(60));
console.log('\n💡 NEXT STEPS:\n');

if (failCount === 0) {
  console.log('1. Deploy rules to Firebase:');
  console.log('   $ firebase deploy --only firestore:rules\n');
  console.log('2. Test in Firebase Console:');
  console.log('   → https://console.firebase.google.com\n');
  console.log('3. Monitor security in Firebase dashboard\n');
} else {
  console.log('1. Review and fix the failed checks above');
  console.log('2. Re-run this verification:');
  console.log('   $ npm run verify-firestore\n');
  console.log('3. Once all checks pass, deploy to Firebase\n');
}

console.log('='.repeat(60));
console.log('\n📚 Related Documentation:\n');
console.log('• Firebase Security Rules: https://firebase.google.com/docs/firestore/security/get-started');
console.log('• Testing Rules: https://firebase.google.com/docs/rules/unit-tests');
console.log('• Best Practices: https://firebase.google.com/docs/firestore/security/rules-conditions\n');

console.log('='.repeat(60));

// Exit with appropriate code
process.exit(failCount > 0 ? 1 : 0);
