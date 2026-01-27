/**
 * Weather Service - Fetches weather data from OpenWeather API
 */

interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  location?: string;
}

/**
 * Fetch weather forecast for a specific date
 * @param date - Target date to get weather for
 * @param latitude - Optional latitude (defaults to user location or fallback)
 * @param longitude - Optional longitude (defaults to user location or fallback)
 * @returns Weather data including temperature, condition, and description
 */
export async function fetchWeatherForecast(
  date: Date,
  latitude?: number,
  longitude?: number
): Promise<WeatherData | null> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      console.error('OpenWeather API key not configured');
      return null;
    }

    // Use provided coordinates or default to a generic location (e.g., Hyderabad, India)
    const lat = latitude || 17.385044;
    const lon = longitude || 78.486671;

    // Calculate days from now
    const now = new Date();
    const daysFromNow = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // If the date is today or in the past, get current weather
    if (daysFromNow <= 0) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );

      if (!response.ok) {
        console.error('Failed to fetch current weather:', response.statusText);
        return null;
      }

      const data = await response.json();

      return {
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        location: data.name,
      };
    }

    // For future dates within 5 days, use the 5-day forecast
    if (daysFromNow <= 5) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );

      if (!response.ok) {
        console.error('Failed to fetch weather forecast:', response.statusText);
        return null;
      }

      const data = await response.json();

      // Find the forecast closest to noon on the target date
      const targetDate = new Date(date);
      targetDate.setHours(12, 0, 0, 0);

      let closestForecast = data.list[0];
      let smallestDiff = Math.abs(new Date(closestForecast.dt * 1000).getTime() - targetDate.getTime());

      for (const forecast of data.list) {
        const forecastDate = new Date(forecast.dt * 1000);
        const diff = Math.abs(forecastDate.getTime() - targetDate.getTime());
        
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestForecast = forecast;
        }
      }

      return {
        temp: Math.round(closestForecast.main.temp),
        condition: closestForecast.weather[0].main,
        description: closestForecast.weather[0].description,
        location: data.city.name,
      };
    }

    // For dates beyond 5 days, return a generic message
    // (Free OpenWeather API doesn't support long-range forecasts)
    console.warn(`Weather forecast not available for ${daysFromNow} days ahead`);
    return {
      temp: 25, // Default temperature
      condition: 'Clear',
      description: 'Weather forecast not available for dates beyond 5 days',
      location: 'Unknown',
    };

  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    return null;
  }
}

/**
 * Get weather-appropriate clothing suggestions based on temperature and conditions
 * @param weatherData - Weather data object
 * @returns Array of clothing suggestions
 */
export function getWeatherClothingSuggestions(weatherData: WeatherData): string[] {
  const suggestions: string[] = [];
  const { temp, condition } = weatherData;

  // Temperature-based suggestions
  if (temp < 10) {
    suggestions.push('Heavy coat or winter jacket');
    suggestions.push('Warm layers (sweaters, thermals)');
    suggestions.push('Scarf, gloves, and winter accessories');
    suggestions.push('Closed-toe shoes or boots');
  } else if (temp < 15) {
    suggestions.push('Light jacket or cardigan');
    suggestions.push('Long sleeves recommended');
    suggestions.push('Consider layering');
  } else if (temp < 25) {
    suggestions.push('Comfortable layering options');
    suggestions.push('Light fabrics');
    suggestions.push('Versatile pieces that can be layered');
  } else if (temp < 30) {
    suggestions.push('Light, breathable fabrics');
    suggestions.push('Short sleeves or sleeveless options');
    suggestions.push('Light colors to reflect heat');
  } else {
    suggestions.push('Minimal, breathable clothing');
    suggestions.push('Light colors essential');
    suggestions.push('Sun protection (hat, sunglasses)');
    suggestions.push('Moisture-wicking fabrics');
  }

  // Condition-based suggestions
  if (condition.toLowerCase().includes('rain')) {
    suggestions.push('Waterproof jacket or raincoat');
    suggestions.push('Water-resistant footwear');
    suggestions.push('Avoid delicate fabrics');
    suggestions.push('Consider bringing an umbrella');
  } else if (condition.toLowerCase().includes('snow')) {
    suggestions.push('Waterproof winter boots');
    suggestions.push('Insulated outerwear');
    suggestions.push('Moisture-resistant materials');
  } else if (condition.toLowerCase().includes('wind')) {
    suggestions.push('Windbreaker or wind-resistant jacket');
    suggestions.push('Secure accessories (avoid loose scarves)');
  }

  return suggestions;
}
