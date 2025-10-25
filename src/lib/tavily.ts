type TavilyResult = {
  amazon?: string | null;
  flipkart?: string | null;
  myntra?: string | null;
};

const TAVILY_API_URL = process.env.TAVILY_API_URL || 'https://api.tavily.ai/v1/search';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

export async function tavilySearch(query: string, colors: string[] = [], gender?: string, occasion?: string): Promise<TavilyResult> {
  if (!TAVILY_API_KEY) {
    console.warn('Tavily API key not configured; returning null links.');
    return { amazon: null, flipkart: null, myntra: null };
  }

  try {
    const body = {
      query,
      colors,
      gender,
      occasion,
      marketplaces: ['amazon', 'flipkart', 'myntra'],
      limit: 3,
    };

    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('Tavily search failed', await res.text());
      return { amazon: null, flipkart: null, myntra: null };
    }

    const data: any = await res.json();

    // Normalize expected response shape. This is best-effort; Tavily responses may vary.
    const amazon = (data && (data.marketplaces?.amazon?.[0]?.url || data.results?.find((r: any) => r.marketplace === 'amazon')?.url)) || null;
    const flipkart = (data && (data.marketplaces?.flipkart?.[0]?.url || data.results?.find((r: any) => r.marketplace === 'flipkart')?.url)) || null;
    const myntra = (data && (data.marketplaces?.myntra?.[0]?.url || data.results?.find((r: any) => r.marketplace === 'myntra')?.url)) || null;

    return { amazon, flipkart, myntra };
  } catch (err) {
    console.warn('Tavily search error', err);
    return { amazon: null, flipkart: null, myntra: null };
  }
}

export default tavilySearch;
