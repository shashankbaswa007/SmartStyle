/**
 * 🔍 Likes Diagnostic Script
 * 
 * Run this in the browser console to check why likes aren't showing up
 * Copy and paste this entire script into the browser console while on the app
 */

(async function diagnoseLikesIssue() {
  console.log('🔍 === LIKES DIAGNOSTIC STARTED ===');
  console.log('');
  
  try {
    // Step 1: Check Authentication
    console.log('Step 1: Checking Authentication...');
    const { auth } = await import('/src/lib/firebase');
    const user = auth.currentUser;
    
    if (!user) {
      console.error('❌ NOT AUTHENTICATED!');
      console.log('👉 Please sign in first, then run this script again');
      return;
    }
    
    console.log('✅ Authenticated');
    console.log('   User ID:', user.uid);
    console.log('   Email:', user.email || 'N/A');
    console.log('   Provider:', user.providerData[0]?.providerId || 'unknown');
    console.log('');
    
    // Step 2: Check Firestore Connection
    console.log('Step 2: Checking Firestore Connection...');
    const { db } = await import('/src/lib/firebase');
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    
    console.log('✅ Firestore initialized');
    console.log('   Type:', db.type);
    console.log('');
    
    // Step 3: Check if Collection Exists
    console.log('Step 3: Checking likedOutfits Collection...');
    const likesRef = collection(db, 'users', user.uid, 'likedOutfits');
    console.log('   Collection path:', `users/${user.uid}/likedOutfits`);
    
    // Try to get documents
    const snapshot = await getDocs(likesRef);
    console.log('   Documents found:', snapshot.size);
    console.log('');
    
    if (snapshot.empty) {
      console.log('ℹ️ Collection is empty - no likes saved yet');
      console.log('');
      console.log('💡 To test saving:');
      console.log('   1. Go to Style Advisor page');
      console.log('   2. Upload a photo');
      console.log('   3. Click the heart ❤️ button on an outfit');
      console.log('   4. Come back here and run this script again');
      return;
    }
    
    // Step 4: Inspect Documents
    console.log('Step 4: Inspecting Documents...');
    console.log('');
    
    let validCount = 0;
    let invalidCount = 0;
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const isValid = data.title && data.imageUrl;
      
      if (isValid) {
        validCount++;
        console.log(`Document ${index + 1} [VALID] ✅`);
        console.log('   ID:', doc.id);
        console.log('   Title:', data.title);
        console.log('   Image URL:', data.imageUrl ? '✅ Present' : '❌ Missing');
        console.log('   Description:', data.description ? '✅ Present' : '❌ Missing');
        console.log('   Items:', data.items?.length || 0, 'items');
        console.log('   Colors:', data.colorPalette?.length || 0, 'colors');
        console.log('   Liked At:', data.likedAt ? new Date(data.likedAt).toLocaleString() : 'N/A');
        console.log('   Recommendation ID:', data.recommendationId || 'N/A');
      } else {
        invalidCount++;
        console.log(`Document ${index + 1} [INVALID] ❌`);
        console.log('   ID:', doc.id);
        console.log('   Has Title:', !!data.title);
        console.log('   Has Image URL:', !!data.imageUrl);
        console.log('   Raw Data:', data);
      }
      console.log('');
    });
    
    // Step 5: Summary
    console.log('=== SUMMARY ===');
    console.log('Total documents:', snapshot.size);
    console.log('Valid documents:', validCount);
    console.log('Invalid documents:', invalidCount);
    console.log('');
    
    if (validCount === 0) {
      console.log('❌ ISSUE FOUND: All documents are invalid!');
      console.log('');
      console.log('💡 This means the data structure is wrong.');
      console.log('   Check the saveLikedOutfit function to ensure it saves:');
      console.log('   - title');
      console.log('   - imageUrl');
      console.log('   - description');
      console.log('   - items');
      console.log('   - colorPalette');
      console.log('   - shoppingLinks');
      console.log('   - likedAt');
    } else {
      console.log('✅ Data looks good!');
      console.log('');
      console.log('If likes still don\'t show on /likes page:');
      console.log('   1. Hard refresh the page (Cmd+Shift+R)');
      console.log('   2. Clear browser cache');
      console.log('   3. Check browser console for errors');
      console.log('   4. Deploy Firestore indexes:');
      console.log('      firebase deploy --only firestore:indexes');
    }
    
    // Step 6: Test getLikedOutfits Function
    console.log('');
    console.log('Step 6: Testing getLikedOutfits Function...');
    const { getLikedOutfits } = await import('/src/lib/likedOutfits');
    const outfits = await getLikedOutfits(user.uid);
    
    console.log('   Function returned:', outfits.length, 'outfits');
    console.log('   Expected:', validCount, 'outfits');
    
    if (outfits.length !== validCount) {
      console.error('❌ MISMATCH! Function filtering out valid documents');
    } else {
      console.log('✅ Function working correctly');
    }
    
    console.log('');
    console.log('=== DIAGNOSTIC COMPLETE ===');
    
  } catch (error) {
    console.error('❌ ERROR during diagnostic:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });
    
    if (error.code === 'permission-denied') {
      console.log('');
      console.log('💡 PERMISSION DENIED ERROR');
      console.log('   This means Firestore rules are blocking access.');
      console.log('   Deploy rules with: firebase deploy --only firestore:rules');
    }
  }
})();
