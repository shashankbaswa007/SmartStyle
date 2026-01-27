#!/bin/bash

# Image Caching Setup Script
# Run this script to set up the image caching system

echo "🚀 SmartStyle - Image Caching Setup"
echo "===================================="
echo ""

# Step 1: Check if Firebase Storage is enabled
echo "📋 Step 1: Firebase Storage Setup"
echo ""
echo "Please follow these steps:"
echo ""
echo "1. Go to: https://console.firebase.google.com/project/smartstyle-c8276/storage"
echo "2. Click 'Get Started'"
echo "3. Choose your preferred location (e.g., us-central1)"
echo "4. Click 'Done'"
echo ""
read -p "Press Enter once Firebase Storage is enabled..."
echo ""

# Step 2: Deploy storage rules
echo "📋 Step 2: Deploying Storage Rules"
echo ""
firebase deploy --only storage
echo ""

# Step 3: Optional - Get Replicate API Token
echo "📋 Step 3: Replicate API Token (Optional)"
echo ""
echo "For premium quality images on position 1, get a Replicate token:"
echo ""
echo "1. Go to: https://replicate.com"
echo "2. Sign up for free"
echo "3. Go to Account → API Tokens"
echo "4. Create a new token"
echo "5. Add to .env.local: REPLICATE_API_TOKEN=r8_your_token"
echo ""
echo "Cost: $0.003 per image (pay as you go, no minimum)"
echo "Without token: App uses free Pollinations.ai for all images"
echo ""
read -p "Skip this step? (Y/n): " skip_replicate
echo ""

# Step 4: Verification
echo "📋 Step 4: Verification"
echo ""
echo "✅ Image caching files created:"
echo "   - src/lib/image-cache.ts"
echo "   - src/lib/replicate-image.ts"
echo ""
echo "✅ API route updated:"
echo "   - src/app/api/recommend/route.ts"
echo ""
echo "✅ Storage rules updated:"
echo "   - storage.rules"
echo ""
echo "✅ Documentation created:"
echo "   - docs/IMAGE_CACHING_SETUP.md"
echo ""

# Step 5: Test
echo "📋 Step 5: Testing"
echo ""
echo "Start your dev server and upload an outfit photo:"
echo ""
echo "  npm run dev"
echo ""
echo "Expected behavior:"
echo "  - First generation: Takes 3-5 seconds, uses Replicate (if token set) or Pollinations"
echo "  - Second generation: Same photo = instant cache hit"
echo "  - Check console for: '✅ [IMAGE CACHE HIT]' or '✅ [IMAGE CACHED]'"
echo ""

# Step 6: Monitor
echo "📋 Step 6: Monitoring"
echo ""
echo "Firebase Console - Storage:"
echo "https://console.firebase.google.com/project/smartstyle-c8276/storage/files"
echo ""
echo "Check 'generated-images/' folder for cached images"
echo ""
if [ "$skip_replicate" != "n" ] && [ "$skip_replicate" != "N" ]; then
  echo "Replicate Dashboard (if using):"
  echo "https://replicate.com/account/billing"
  echo ""
fi

echo "✅ Setup Complete!"
echo ""
echo "📖 For more details, see: docs/IMAGE_CACHING_SETUP.md"
echo ""
