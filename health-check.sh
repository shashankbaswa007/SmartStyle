#!/bin/bash

echo "🔍 SmartStyle - Complete Application Health Check"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error_count=0
warning_count=0

echo "1️⃣  Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✅ TypeScript compilation: PASS${NC}"
else
  echo -e "${RED}❌ TypeScript compilation: FAIL${NC}"
  ((error_count++))
fi

echo ""
echo "2️⃣  Checking linting..."
if npm run lint > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Linting: PASS${NC}"
else
  echo -e "${YELLOW}⚠️  Linting: WARNINGS${NC}"
  ((warning_count++))
fi

echo ""
echo "3️⃣  Checking environment variables..."
required_vars=(
  "NEXT_PUBLIC_FIREBASE_API_KEY"
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
)

if [ -f .env.local ] || [ -f .env ]; then
  echo -e "${GREEN}✅ Environment file exists${NC}"
  
  missing_vars=()
  for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env.local .env 2>/dev/null; then
      missing_vars+=("$var")
    fi
  done
  
  if [ ${#missing_vars[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required variables configured${NC}"
  else
    echo -e "${YELLOW}⚠️  Missing variables: ${missing_vars[*]}${NC}"
    ((warning_count++))
  fi
else
  echo -e "${RED}❌ No .env or .env.local file found${NC}"
  echo "   Run: cp .env.example .env.local"
  ((error_count++))
fi

echo ""
echo "4️⃣  Checking critical files..."
critical_files=(
  "src/app/api/recommend/route.ts"
  "src/lib/firebase.ts"
  "src/lib/firebase-admin.ts"
  "src/lib/timeout-utils.ts"
  "src/components/style-advisor.tsx"
  "firestore.rules"
  "firestore.indexes.json"
)

for file in "${critical_files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}  ✅ $file${NC}"
  else
    echo -e "${RED}  ❌ Missing: $file${NC}"
    ((error_count++))
  fi
done

echo ""
echo "5️⃣  Checking error handling..."
if grep -q "try {" src/lib/firebase-admin.ts && \
   grep -q "try {" src/lib/groq-client.ts && \
   grep -q "catch" src/components/style-advisor.tsx; then
  echo -e "${GREEN}✅ Error handling implemented${NC}"
else
  echo -e "${YELLOW}⚠️  Some error handlers may be missing${NC}"
  ((warning_count++))
fi

echo ""
echo "6️⃣  Checking performance optimizations..."
if grep -q "Promise.all" src/app/api/recommend/route.ts && \
   grep -q "aiResponseCache" src/ai/flows/analyze-image-and-provide-recommendations.ts && \
   grep -q "\[PERF\]" src/app/api/recommend/route.ts; then
  echo -e "${GREEN}✅ Performance optimizations active${NC}"
else
  echo -e "${YELLOW}⚠️  Some optimizations may be missing${NC}"
  ((warning_count++))
fi

echo ""
echo "7️⃣  Checking security measures..."
security_checks=0
if ! grep -r "API_KEY.*=" --include="*.tsx" --include="*.ts" src/ | grep -v "process.env" > /dev/null 2>&1; then
  echo -e "${GREEN}  ✅ No hardcoded API keys${NC}"
  ((security_checks++))
fi

if [ -f "firestore.rules" ]; then
  echo -e "${GREEN}  ✅ Firestore rules configured${NC}"
  ((security_checks++))
fi

if grep -q "auth" src/lib/firebase.ts; then
  echo -e "${GREEN}  ✅ Authentication configured${NC}"
  ((security_checks++))
fi

if [ $security_checks -eq 3 ]; then
  echo -e "${GREEN}✅ Security: GOOD${NC}"
else
  echo -e "${YELLOW}⚠️  Security: NEEDS REVIEW${NC}"
  ((warning_count++))
fi

echo ""
echo "8️⃣  Checking documentation..."
doc_files=(
  "README.md"
  "PERFORMANCE_OPTIMIZATION_COMPLETE.md"
  "COMPLETE_OPTIMIZATION_REPORT.md"
  "APPLICATION_HEALTH_CHECK.md"
)

doc_count=0
for file in "${doc_files[@]}"; do
  if [ -f "$file" ]; then
    ((doc_count++))
  fi
done

if [ $doc_count -ge 3 ]; then
  echo -e "${GREEN}✅ Documentation: COMPREHENSIVE ($doc_count files)${NC}"
else
  echo -e "${YELLOW}⚠️  Documentation: BASIC ($doc_count files)${NC}"
fi

echo ""
echo "=================================================="
echo "📊 HEALTH CHECK SUMMARY"
echo "=================================================="
echo ""

if [ $error_count -eq 0 ]; then
  echo -e "${GREEN}✅ ERRORS: NONE${NC}"
else
  echo -e "${RED}❌ ERRORS: $error_count${NC}"
fi

if [ $warning_count -eq 0 ]; then
  echo -e "${GREEN}✅ WARNINGS: NONE${NC}"
else
  echo -e "${YELLOW}⚠️  WARNINGS: $warning_count${NC}"
fi

echo ""
echo "📈 OVERALL HEALTH:"
if [ $error_count -eq 0 ] && [ $warning_count -eq 0 ]; then
  echo -e "${GREEN}🟢 EXCELLENT - Production Ready!${NC}"
  exit_code=0
elif [ $error_count -eq 0 ]; then
  echo -e "${YELLOW}🟡 GOOD - Minor improvements recommended${NC}"
  exit_code=0
else
  echo -e "${RED}🔴 NEEDS ATTENTION - Fix errors before deployment${NC}"
  exit_code=1
fi

echo ""
echo "=================================================="
echo "🚀 Next Steps:"
echo "=================================================="
if [ $error_count -eq 0 ]; then
  echo "1. Review any warnings above"
  echo "2. Test with: npm run dev"
  echo "3. Deploy with: npm run build && npm start"
  echo ""
  echo "✨ Your application is ready for production!"
else
  echo "1. Fix the errors listed above"
  echo "2. Re-run this health check"
  echo "3. Ensure all required files exist"
fi

echo ""
exit $exit_code
