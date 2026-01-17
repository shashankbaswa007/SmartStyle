/**
 * MSW Handlers for API Mocking
 * 
 * Mock Service Worker handlers for all API endpoints
 */

const { http, HttpResponse } = require('msw');

exports.handlers = [
  // Mock recommendation API
  http.post('/api/recommend', async ({ request }: any) => {
    const body = await request.json() as any;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    return HttpResponse.json({
      success: true,
      recommendations: {
        outfit1: {
          id: 'outfit_1',
          items: ['Blue Dress', 'White Heels', 'Gold Necklace'],
          colors: ['#3B82F6', '#FFFFFF', '#F59E0B'],
          style: 'Elegant',
          description: 'Perfect evening outfit',
          occasion: body?.occasion || 'party',
        },
        outfit2: {
          id: 'outfit_2',
          items: ['Red Top', 'Black Pants', 'Silver Earrings'],
          colors: ['#EF4444', '#000000', '#C0C0C0'],
          style: 'Chic',
          description: 'Modern casual look',
          occasion: body?.occasion || 'casual',
        },
        outfit3: {
          id: 'outfit_3',
          items: ['Green Kurta', 'White Palazzo', 'Ethnic Jewelry'],
          colors: ['#10B981', '#FFFFFF'],
          style: 'Traditional',
          description: 'Festive wear',
          occasion: body?.occasion || 'traditional',
        },
      },
      analysis: {
        skinTone: '#C4A57B',
        dominantColors: body?.dressColors || ['#3B82F6', '#FFFFFF'],
      },
    });
  }),

  // Mock Tavily search API
  http.post('/api/tavily/search', async ({ request }: any) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      results: [
        {
          platform: 'Amazon',
          url: 'https://amazon.in/product-1',
          title: `${body?.query || 'Product'} - Amazon`,
          price: '₹1,999',
        },
        {
          platform: 'Myntra',
          url: 'https://myntra.com/product-1',
          title: `${body?.query || 'Product'} - Myntra`,
          price: '₹2,499',
        },
        {
          platform: 'TATA CLiQ',
          url: 'https://tatacliq.com/product-1',
          title: `${body?.query || 'Product'} - TATA CLiQ`,
          price: '₹1,799',
        },
      ],
    });
  }),

  // Mock color matching API
  http.post('/api/getColorMatches', async ({ request }: any) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      complementary: ['#FFA500', '#00BFFF'],
      analogous: ['#3B82F6', '#8B5CF6', '#06B6D4'],
      triadic: ['#FF5733', '#33FF57', '#5733FF'],
    });
  }),

  // Mock weather API
  http.get('https://api.openweathermap.org/data/2.5/weather', () => {
    return HttpResponse.json({
      main: {
        temp: 25,
        humidity: 60,
      },
      weather: [
        {
          main: 'Clear',
          description: 'clear sky',
        },
      ],
      name: 'Mumbai',
    });
  }),

  // Mock image generation (Pollinations)
  http.get('https://image.pollinations.ai/prompt/*', () => {
    // Return a small test image
    return new HttpResponse(
      new Blob(['fake-image-data'], { type: 'image/jpeg' }),
      {
        headers: {
          'Content-Type': 'image/jpeg',
        },
      }
    );
  }),

  // Error scenarios
  http.post('/api/recommend-error', () => {
    return HttpResponse.json(
      { error: 'AI service unavailable' },
      { status: 500 }
    );
  }),

  http.post('/api/recommend-quota', () => {
    return HttpResponse.json(
      { error: 'API quota exceeded' },
      { status: 429 }
    );
  }),
];
