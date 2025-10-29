type TavilyResult = {
  amazon?: string | null;
  myntra?: string | null;
  tatacliq?: string | null; // Replaced Nykaa with TATA CLiQ
};

const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

// Helper to extract upper-half clothing items
const extractUpperHalfItem = (query: string): string => {
  const upperHalfKeywords = [
    'shirt', 't-shirt', 'tshirt', 'tee', 'polo',
    'coat', 'jacket', 'blazer', 'cardigan',
    'top', 'blouse', 'sweater', 'hoodie',
    'sweatshirt', 'vest', 'waistcoat'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check if query contains upper-half items
  for (const keyword of upperHalfKeywords) {
    if (lowerQuery.includes(keyword)) {
      // Extract the specific item with any adjectives before it
      const words = query.split(' ');
      const keywordIndex = words.findIndex(w => w.toLowerCase().includes(keyword));
      if (keywordIndex >= 0) {
        // Get up to 3 words before the keyword and the keyword itself
        const startIndex = Math.max(0, keywordIndex - 2);
        return words.slice(startIndex, keywordIndex + 1).join(' ');
      }
    }
  }
  
  // If no specific upper-half item found, return the first few words
  return query.split(' ').slice(0, 3).join(' ');
};

export async function tavilySearch(query: string, colors: string[] = [], gender?: string, occasion?: string): Promise<TavilyResult> {
  if (!TAVILY_API_KEY) {
    console.warn('⚠️ Tavily API key not configured; returning fallback search links.');
    const searchTerms = query.replace(/\s+/g, '+');
    return {
      amazon: `https://www.amazon.in/s?k=${searchTerms}`,
      tatacliq: `https://www.tatacliq.com/search/?searchCategory=all&text=${searchTerms}`,
      myntra: `https://www.myntra.com/${searchTerms.replace(/\+/g, '-')}`,
    };
  }

  // Clean the query - remove any hex color codes
  let cleanQuery = query.replace(/#[0-9A-Fa-f]{6}/g, '').replace(/#[0-9A-Fa-f]{3}/g, '').trim();

  try {
    // Check if query is already optimized (from Gemini analysis)
    // Gemini queries are structured: "gender item color fabric pattern occasion"
    const isGeminiOptimized = cleanQuery.split(' ').length >= 4 && 
      (cleanQuery.toLowerCase().includes('women') || 
       cleanQuery.toLowerCase().includes('men') || 
       cleanQuery.toLowerCase().includes('male') || 
       cleanQuery.toLowerCase().includes('female'));
    
    let enhancedQuery: string;
    
    if (isGeminiOptimized) {
      // Use Gemini's query directly - it's already optimized
      enhancedQuery = `${cleanQuery} online shopping India`;
      console.log(`🎯 Using Gemini-optimized query: "${enhancedQuery}"`);
    } else {
      // Fallback: Extract upper-half clothing item for basic queries
      const upperHalfItem = extractUpperHalfItem(cleanQuery);
      const genderPrefix = gender ? `${gender} ` : '';
      const occasionSuffix = occasion ? ` ${occasion}` : '';
      enhancedQuery = `${genderPrefix}${upperHalfItem}${occasionSuffix} online shopping India`;
      console.log(`🔍 Basic query enhanced: "${enhancedQuery}"`);
    }
    
    console.log(`   Original query: "${cleanQuery}"`);
    console.log(`   Gender: ${gender || 'not specified'}`);
    console.log(`   Occasion: ${occasion || 'not specified'}`);

    const body = {
      api_key: TAVILY_API_KEY,
      query: enhancedQuery,
      search_depth: 'advanced',
      include_answer: false,
      include_domains: ['amazon.in', 'myntra.com', 'tatacliq.com'],
      max_results: 20, // Increased for better coverage
    };

    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn('❌ Tavily search failed:', res.status, errorText);
      throw new Error(`Tavily API error: ${res.status}`);
    }

    const data: any = await res.json();
    console.log(`✅ Tavily found ${data.results?.length || 0} results`);

    // Extract links from results for Amazon, Myntra, and TATA CLiQ
    let amazon: string | null = null;
    let myntra: string | null = null;
    let tatacliq: string | null = null;

    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        const url = result.url || '';
        
        // Only accept valid product pages, not just domain homepages
        if (!amazon && (url.includes('amazon.in') || url.includes('amazon.com'))) {
          // Ensure it's a product or search page, not just the homepage
          if (url.includes('/s?') || url.includes('/dp/') || url.includes('/gp/')) {
            amazon = url;
          }
        }
        if (!myntra && url.includes('myntra.com')) {
          // Myntra product pages have specific patterns
          if (url.includes('.html') || url.includes('product') || url.includes('/buy/')) {
            myntra = url;
          }
        }
        if (!tatacliq && url.includes('tatacliq.com')) {
          // TATA CLiQ product pages
          if (url.includes('/p-') || url.includes('/search/') || url.includes('?text=')) {
            tatacliq = url;
          }
        }
        
        // Stop if we have all three
        if (amazon && myntra && tatacliq) break;
      }
    }

    // Create BETTER fallback search URLs for any missing links
    // Use the clean query for fallback search URLs
    const searchTerms = cleanQuery.replace(/\s+/g, '+');
    const genderParam = gender ? `+${gender}` : '';
    
    if (!amazon) {
      amazon = `https://www.amazon.in/s?k=${searchTerms}${genderParam}&rh=n:1968024031`; // Fashion category
      console.log('⚠️ No Amazon link found, using category search URL');
    }
    
    if (!tatacliq) {
      // TATA CLiQ uses category-based search
      const genderCategory = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'all';
      tatacliq = `https://www.tatacliq.com/search/?searchCategory=${genderCategory}&text=${searchTerms}`;
      console.log('⚠️ No TATA CLiQ link found, using category search URL');
    }
    
    if (!myntra) {
      // Myntra uses category-based URLs
      const genderPath = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'shop';
      myntra = `https://www.myntra.com/${genderPath}?rawQuery=${searchTerms}`;
      console.log('⚠️ No Myntra link found, using category search URL');
    }

    console.log('🛍️ Final shopping links:', { 
      amazon: amazon?.substring(0, 60) + '...', 
      myntra: myntra?.substring(0, 60) + '...', 
      tatacliq: tatacliq?.substring(0, 60) + '...' 
    });
    
    return { amazon, myntra, tatacliq };
  } catch (err) {
    console.error('❌ Tavily search error:', err);
    
    // Even on error, provide fallback search URLs
    const searchTerms = query.replace(/\s+/g, '+');
    const genderParam = gender ? `+${gender}` : '';
    
    return {
      amazon: `https://www.amazon.in/s?k=${searchTerms}${genderParam}&rh=n:1968024031`,
      tatacliq: gender === 'male' 
        ? `https://www.tatacliq.com/search/?searchCategory=men&text=${searchTerms}`
        : gender === 'female'
        ? `https://www.tatacliq.com/search/?searchCategory=women&text=${searchTerms}`
        : `https://www.tatacliq.com/search/?searchCategory=all&text=${searchTerms}`,
      myntra: gender === 'male'
        ? `https://www.myntra.com/men?rawQuery=${searchTerms}`
        : gender === 'female'
        ? `https://www.myntra.com/women?rawQuery=${searchTerms}`
        : `https://www.myntra.com/shop?rawQuery=${searchTerms}`,
    };
  }
}

export default tavilySearch;
