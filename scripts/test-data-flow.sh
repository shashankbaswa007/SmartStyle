#!/bin/bash

echo "🧪 Testing SmartStyle Data Flow"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dev server is running
echo "1️⃣  Checking dev server..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Dev server is running"
else
    echo -e "${RED}✗${NC} Dev server is not running"
    echo "   Start it with: npm run dev"
    exit 1
fi

echo ""
echo "2️⃣  Checking API endpoints..."

# Check recommend API
if curl -s -X OPTIONS http://localhost:3000/api/recommend > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} /api/recommend is accessible"
else
    echo -e "${RED}✗${NC} /api/recommend is not accessible"
fi

# Check tavily API
if curl -s -X OPTIONS http://localhost:3000/api/tavily/search > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} /api/tavily/search is accessible"
else
    echo -e "${YELLOW}⚠${NC} /api/tavily/search may not be accessible"
fi

echo ""
echo "3️⃣  Checking environment variables..."

# Check if .env.local exists
if [ -f .env.local ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
    
    # Check for key variables (without showing values)
    if grep -q "GROQ_API_KEY=" .env.local 2>/dev/null; then
        echo -e "${GREEN}✓${NC} GROQ_API_KEY is configured"
    else
        echo -e "${RED}✗${NC} GROQ_API_KEY is missing"
    fi
    
    if grep -q "GOOGLE_API_KEY=" .env.local 2>/dev/null; then
        echo -e "${GREEN}✓${NC} GOOGLE_API_KEY is configured"
    else
        echo -e "${YELLOW}⚠${NC} GOOGLE_API_KEY is missing (fallback won't work)"
    fi
    
    if grep -q "OPENWEATHER_API_KEY=" .env.local 2>/dev/null; then
        echo -e "${GREEN}✓${NC} OPENWEATHER_API_KEY is configured"
    else
        echo -e "${YELLOW}⚠${NC} OPENWEATHER_API_KEY is missing"
    fi
else
    echo -e "${RED}✗${NC} .env.local not found"
fi

echo ""
echo "4️⃣  Testing build configuration..."

# Check if build was successful
if [ -d ".next" ]; then
    echo -e "${GREEN}✓${NC} .next directory exists"
else
    echo -e "${YELLOW}⚠${NC} .next directory missing (run npm run build)"
fi

echo ""
echo "5️⃣  Checking TypeScript compilation..."

# Run type check
echo "   Running: npx tsc --noEmit..."
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}✗${NC} TypeScript compilation errors found"
    echo "   Run: npx tsc --noEmit to see details"
else
    echo -e "${GREEN}✓${NC} No TypeScript errors"
fi

echo ""
echo "6️⃣  Testing critical files exist..."

FILES=(
    "src/app/api/recommend/route.ts"
    "src/ai/flows/analyze-image-and-provide-recommendations.ts"
    "src/lib/groq-client.ts"
    "src/lib/personalization.ts"
    "src/lib/preference-engine.ts"
    "src/lib/request-cache.ts"
    "firestore.rules"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""
echo "7️⃣  Checking Firestore rules..."

if [ -f "firestore.rules" ]; then
    if grep -q "users/{userId}/preferences" firestore.rules; then
        echo -e "${GREEN}✓${NC} Preference rules defined"
    else
        echo -e "${YELLOW}⚠${NC} Preference rules may be incomplete"
    fi
    
    if grep -q "users/{userId}/blocklists" firestore.rules; then
        echo -e "${GREEN}✓${NC} Blocklist rules defined"
    else
        echo -e "${YELLOW}⚠${NC} Blocklist rules may be incomplete"
    fi
fi

echo ""
echo "================================"
echo "📊 Summary"
echo "================================"
echo ""
echo "✅ Quick fixes applied:"
echo "   - Groq response parsing (optional chaining)"
echo "   - TypeScript interfaces updated"
echo "   - Firestore rules enhanced"
echo ""
echo "⚠️  Manual steps required:"
echo "   1. Restart dev server: Ctrl+C then npm run dev"
echo "   2. Deploy Firestore rules: firebase deploy --only firestore:rules"
echo "   3. Test with authenticated user"
echo ""
echo "🧪 To test the flow:"
echo "   1. Open http://localhost:3000"
echo "   2. Upload an image with occasion/gender"
echo "   3. Check browser console for logs"
echo "   4. Watch terminal for Groq success (no Gemini fallback)"
echo ""
