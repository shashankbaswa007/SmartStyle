#!/bin/bash

# Firebase Admin Setup Script
# This script helps you set up Firebase Admin credentials

echo "🔥 Firebase Admin SDK Setup"
echo "================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not installed"
    echo "Install with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI detected"
echo ""

# Check current project
PROJECT=$(firebase projects:list --json 2>/dev/null | grep -o '"projectId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT" ]; then
    echo "❌ No Firebase project detected"
    echo "Run: firebase login"
    echo "Then: firebase use --add"
    exit 1
fi

echo "📋 Current project: $PROJECT"
echo ""

# Path to service account key
KEY_FILE="firebase-admin-key.json"

echo "📝 Steps to get your Firebase Admin SDK key:"
echo ""
echo "1. Go to: https://console.firebase.google.com/project/$PROJECT/settings/serviceaccounts/adminsdk"
echo "2. Click 'Generate new private key'"
echo "3. Save the JSON file as '$KEY_FILE' in this directory"
echo ""
echo "Press Enter when you've downloaded the key..."
read

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Key file not found: $KEY_FILE"
    echo "Please download it and try again"
    exit 1
fi

echo "✅ Key file found!"
echo ""

# Minify JSON (remove whitespace)
echo "🔄 Processing key file..."
KEY_CONTENT=$(cat "$KEY_FILE" | jq -c .)

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📄 Creating .env.local from .env.example..."
    cp .env.example .env.local
fi

# Check if key already exists in .env.local
if grep -q "FIREBASE_SERVICE_ACCOUNT_KEY=" .env.local; then
    echo "⚠️  FIREBASE_SERVICE_ACCOUNT_KEY already exists in .env.local"
    echo "Replace it? (y/n)"
    read REPLACE
    if [ "$REPLACE" != "y" ]; then
        echo "Skipping..."
        exit 0
    fi
    # Remove old key
    sed -i.bak '/FIREBASE_SERVICE_ACCOUNT_KEY=/d' .env.local
fi

# Add key to .env.local
echo "" >> .env.local
echo "# Firebase Admin SDK (Auto-generated)" >> .env.local
echo "FIREBASE_SERVICE_ACCOUNT_KEY='$KEY_CONTENT'" >> .env.local

echo "✅ Added FIREBASE_SERVICE_ACCOUNT_KEY to .env.local"
echo ""

# Secure the files
chmod 600 .env.local
chmod 600 "$KEY_FILE"

echo "🔒 Secured file permissions"
echo ""

# Optional: Delete the JSON file
echo "🗑️  Delete the original JSON file? (Recommended for security) (y/n)"
read DELETE
if [ "$DELETE" = "y" ]; then
    rm "$KEY_FILE"
    echo "✅ Deleted $KEY_FILE"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart your dev server: npm run dev"
echo "2. Test likes functionality"
echo "3. Check console - should see: '✅ Firebase Admin SDK initialized successfully'"
echo ""
echo "⚠️  IMPORTANT: Never commit .env.local or $KEY_FILE to git!"
echo ""
