#!/bin/bash

# Test Likes Database Connection
# This script helps diagnose likes page issues

echo "🔍 === LIKES DATABASE TEST ==="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not installed"
    echo "   Install with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI installed"
echo ""

# Check current project
echo "📊 Current Firebase Project:"
firebase projects:list | grep "Your Project" || firebase use
echo ""

# Check Firestore indexes
echo "📊 Firestore Indexes Status:"
firebase firestore:indexes list
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local exists"
    
    # Check for Firebase Admin key (without revealing it)
    if grep -q "FIREBASE_SERVICE_ACCOUNT_KEY" .env.local; then
        echo "✅ FIREBASE_SERVICE_ACCOUNT_KEY found in .env.local"
    else
        echo "⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local"
        echo "   This may cause 'client-side only' mode"
    fi
else
    echo "⚠️  .env.local not found"
    echo "   Create it from .env.example"
fi

echo ""
echo "=== NEXT STEPS ==="
echo ""
echo "1. Deploy indexes if needed:"
echo "   firebase deploy --only firestore:indexes"
echo ""
echo "2. Wait 5-30 minutes for indexes to build"
echo ""
echo "3. Run the browser diagnostic:"
echo "   - Open your app"
echo "   - Open browser console (F12)"
echo "   - Run: (paste entire content of diagnose-likes.js)"
echo ""
echo "4. Check Firebase Console:"
echo "   https://console.firebase.google.com/project/YOUR_PROJECT/firestore/data"
echo "   Navigate to: users → [your-user-id] → likedOutfits"
echo ""
