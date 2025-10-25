'use server';

import { z } from 'zod';

/**
 * Verify Firebase ID token using REST API and return user ID
 * This avoids needing Firebase Admin SDK credentials
 */
async function verifyUserToken(idToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      console.error('❌ Token verification failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.users && data.users.length > 0) {
      const userId = data.users[0].localId;
      console.log('✅ Token verified successfully for user:', userId);
      return userId;
    }

    console.error('❌ No user found in token verification response');
    return null;
  } catch (error) {
    console.error('❌ Error verifying token:', error);
    return null;
  }
}

const WeatherSchema = z.object({
  lat: z.number(),
  lon: z.number(),
});

export async function getWeatherData(coords: z.infer<typeof WeatherSchema>) {
  const { lat, lon } = coords;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.error('OpenWeather API key not found.');
    return 'Weather data not available. API key missing.';
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenWeather API error:', errorData);
      return `Could not fetch weather. Status: ${response.status}`;
    }
    const data = await response.json();
    return `The weather in ${data.name} is ${data.main.temp}°C with ${data.weather[0].description}.`;
  } catch (error) {
    console.error('Failed to fetch weather data:', error);
    return 'Failed to fetch weather data.';
  }
}

export async function provideFeedback(
  idToken: string,
  recommendationId: string,
  rating: 'like' | 'dislike',
  feedback?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await verifyUserToken(idToken);
    
    if (!userId) {
      console.warn('⚠️ User not authenticated - feedback will not be saved');
      return { 
        success: false, 
        error: 'Please sign in to save feedback on recommendations' 
      };
    }

    console.log(`✅ User ${userId} authenticated, saving feedback...`);

    // Save to Firestore using REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/feedback/${recommendationId}`;

    const firestoreResponse = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          rating: { stringValue: rating },
          feedback: { stringValue: feedback || '' },
          timestamp: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    if (!firestoreResponse.ok) {
      const errorText = await firestoreResponse.text();
      console.error('❌ Firestore error:', errorText);
      return {
        success: false,
        error: 'Failed to save feedback to database.',
      };
    }

    console.log(`✅ Feedback saved: ${rating} for recommendation ${recommendationId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error saving feedback:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save feedback. Please try again.' 
    };
  }
}

export async function saveRecommendationUsage(
  idToken: string,
  recommendationId: string,
  outfitIndex: number,
  outfitTitle: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await verifyUserToken(idToken);
    
    if (!userId) {
      console.warn('⚠️ User not authenticated - recommendation usage will not be tracked');
      return { 
        success: false, 
        error: 'Please sign in to save outfits' 
      };
    }

    console.log(`✅ User ${userId} authenticated, checking recommendation...`);

    // First, check if the recommendation exists using REST API
    const getUrl = `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/recommendationHistory/${recommendationId}`;

    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!getResponse.ok) {
      console.error('❌ Recommendation not found:', recommendationId);
      return { 
        success: false, 
        error: 'Recommendation not found. It may have been deleted or not saved properly.' 
      };
    }

    const recommendationData = await getResponse.json();
    
    // Check if outfit exists at the specified index
    const outfits = recommendationData.fields?.analysis?.mapValue?.fields?.outfitRecommendations?.arrayValue?.values;
    
    if (!outfits || !outfits[outfitIndex]) {
      console.error('❌ Outfit not found at index:', outfitIndex);
      return { 
        success: false, 
        error: 'Outfit not found in recommendation data.' 
      };
    }

    // Save outfit usage to Firestore using REST API
    const usageId = `${recommendationId}_${outfitIndex}`;
    const usageUrl = `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/outfitUsage/${usageId}`;

    const usageResponse = await fetch(usageUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          recommendationId: { stringValue: recommendationId },
          outfitIndex: { integerValue: outfitIndex.toString() },
          outfitTitle: { stringValue: outfitTitle },
          timestamp: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    if (!usageResponse.ok) {
      const errorText = await usageResponse.text();
      console.error('❌ Firestore error saving usage:', errorText);
      return {
        success: false,
        error: 'Failed to save outfit to database.',
      };
    }

    // Update recommendation document to track usage
    const updateUrl = `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/recommendationHistory/${recommendationId}`;

    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          [`outfitUsage.${outfitIndex}`]: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    console.log(`✅ Outfit marked as used: ${recommendationId}[${outfitIndex}] - ${outfitTitle}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error using recommendation:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save outfit. Please try again.' 
    };
  }
}
