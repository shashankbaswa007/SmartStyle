/**
 * Weather Service - Fetches weather data from OpenWeather API
 */

import { executeWithTimeoutAndRetry } from '@/lib/external-request';
import { featureFlags } from '@/lib/feature-flags';

export interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  location?: string;
  humidity?: number;
  precipitationProbability?: number;
  windSpeed?: number;
}

export interface DailyWeatherForecast {
  date: string;
  dayLabel: string;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  condition: string;
  description: string;
  humidity: number;
  precipitationProbability: number;
  windSpeed: number;
}

export interface WeeklyWeatherForecast {
  location?: string;
  generatedAt: string;
  days: DailyWeatherForecast[];
  trendSummary: string;
}

type OpenWeatherForecastEntry = {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  pop?: number;
  wind?: {
    speed?: number;
  };
};

function getDefaultCoordinates(latitude?: number, longitude?: number): { lat: number; lon: number } {
  return {
    lat: latitude || 17.385044,
    lon: longitude || 78.486671,
  };
}

function dayLabelFromIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return 'Day';
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function toIsoLocalDate(unixSecondsUtc: number, timezoneOffsetSeconds: number): string {
  const localMs = (unixSecondsUtc + timezoneOffsetSeconds) * 1000;
  const localDate = new Date(localMs);
  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildTrendSummary(days: DailyWeatherForecast[]): string {
  if (!days.length) return 'No weekly weather trend available.';

  const first = days[0];
  const last = days[days.length - 1];
  const warmingDelta = Math.round(last.tempAvg - first.tempAvg);
  const rainyDays = days.filter((d) => d.precipitationProbability >= 45).length;
  const humidDays = days.filter((d) => d.humidity >= 70).length;

  const tempTrend =
    Math.abs(warmingDelta) <= 1
      ? 'stable temperatures'
      : warmingDelta > 1
        ? `a warming trend of about ${warmingDelta}C`
        : `a cooling trend of about ${Math.abs(warmingDelta)}C`;

  const rainTrend = rainyDays > 0
    ? `${rainyDays} day${rainyDays > 1 ? 's' : ''} with notable rain chances`
    : 'low rain probability through the week';

  const humidityTrend = humidDays > 0
    ? `${humidDays} humid day${humidDays > 1 ? 's' : ''}`
    : 'comfortable humidity overall';

  return `Week outlook: ${tempTrend}, ${rainTrend}, and ${humidityTrend}.`;
}

function summarizeDailyForecast(day: DailyWeatherForecast): string {
  return `${day.dayLabel}: ${day.tempMin}-${day.tempMax}C, ${day.condition.toLowerCase()}, ${day.precipitationProbability}% rain chance, ${day.humidity}% humidity`;
}

export function buildWeeklyWeatherSummary(forecast: WeeklyWeatherForecast): string {
  if (!forecast.days.length) {
    return 'Weekly weather forecast is unavailable. Use weather-flexible layering.';
  }

  const highlights = forecast.days.slice(0, 7).map(summarizeDailyForecast).join('; ');
  return `${forecast.trendSummary} ${highlights}.`;
}

function aggregateForecastToDaily(
  entries: OpenWeatherForecastEntry[],
  timezoneOffsetSeconds: number,
  currentWeather?: WeatherData
): DailyWeatherForecast[] {
  type Bucket = {
    temps: number[];
    mins: number[];
    maxs: number[];
    humidity: number[];
    pop: number[];
    wind: number[];
    conditions: string[];
    descriptions: string[];
  };

  const byDay = new Map<string, Bucket>();

  for (const entry of entries) {
    const key = toIsoLocalDate(entry.dt, timezoneOffsetSeconds);
    const existing = byDay.get(key) || {
      temps: [],
      mins: [],
      maxs: [],
      humidity: [],
      pop: [],
      wind: [],
      conditions: [],
      descriptions: [],
    };

    existing.temps.push(entry.main.temp);
    existing.mins.push(entry.main.temp_min);
    existing.maxs.push(entry.main.temp_max);
    existing.humidity.push(entry.main.humidity);
    existing.pop.push(Math.round((entry.pop || 0) * 100));
    existing.wind.push(entry.wind?.speed || 0);
    existing.conditions.push(entry.weather[0]?.main || 'Clear');
    existing.descriptions.push(entry.weather[0]?.description || 'clear sky');

    byDay.set(key, existing);
  }

  const todayKey = toIsoLocalDate(Math.floor(Date.now() / 1000), timezoneOffsetSeconds);
  const keys = Array.from(byDay.keys()).sort();
  const futureKeys = keys.filter((key) => key >= todayKey).slice(0, 7);

  const days: DailyWeatherForecast[] = futureKeys.map((key) => {
    const bucket = byDay.get(key)!;
    const conditionCounts = new Map<string, number>();
    bucket.conditions.forEach((condition) => {
      conditionCounts.set(condition, (conditionCounts.get(condition) || 0) + 1);
    });

    const topCondition = Array.from(conditionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Clear';
    const topDescription = bucket.descriptions[0] || 'clear sky';
    const avg = (values: number[]) => values.reduce((acc, value) => acc + value, 0) / values.length;

    return {
      date: key,
      dayLabel: dayLabelFromIsoDate(key),
      tempMin: Math.round(Math.min(...bucket.mins)),
      tempMax: Math.round(Math.max(...bucket.maxs)),
      tempAvg: Math.round(avg(bucket.temps)),
      condition: topCondition,
      description: topDescription,
      humidity: Math.round(avg(bucket.humidity)),
      precipitationProbability: Math.round(Math.max(...bucket.pop)),
      windSpeed: Number(avg(bucket.wind).toFixed(1)),
    };
  });

  if (currentWeather) {
    const todayIndex = days.findIndex((day) => day.date === todayKey);
    const today: DailyWeatherForecast = {
      date: todayKey,
      dayLabel: dayLabelFromIsoDate(todayKey),
      tempMin: Math.round(currentWeather.temp),
      tempMax: Math.round(currentWeather.temp),
      tempAvg: Math.round(currentWeather.temp),
      condition: currentWeather.condition,
      description: currentWeather.description,
      humidity: Math.round(currentWeather.humidity ?? 55),
      precipitationProbability: Math.round(currentWeather.precipitationProbability ?? 0),
      windSpeed: Number((currentWeather.windSpeed ?? 0).toFixed(1)),
    };

    if (todayIndex >= 0) {
      days[todayIndex] = {
        ...days[todayIndex],
        ...today,
      };
    } else {
      days.unshift(today);
    }
  }

  while (days.length < 7 && days.length > 0) {
    const last = days[days.length - 1];
    const [y, m, d] = last.date.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextIso = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;

    days.push({
      ...last,
      date: nextIso,
      dayLabel: dayLabelFromIsoDate(nextIso),
      description: `${last.description} (projected)`,
      precipitationProbability: Math.max(0, Math.min(100, last.precipitationProbability - 5)),
    });
  }

  return days.slice(0, 7);
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
      return null;
    }

    const fetchWeatherJson = async (url: string) => {
      if (!featureFlags.externalRetryWrapper) {
        const response = await fetch(url);
        if (!response.ok) return null;
        return response.json();
      }

      return executeWithTimeoutAndRetry(
        async (signal) => {
          const response = await fetch(url, { signal });
          if (!response.ok) {
            const error = new Error(`OpenWeather request failed: ${response.status}`) as Error & { status?: number };
            error.status = response.status;
            throw error;
          }
          return response.json();
        },
        {
          timeoutMs: 4000,
          retries: 1,
          operationName: 'openweather',
        }
      );
    };

    const { lat, lon } = getDefaultCoordinates(latitude, longitude);

    // Calculate days from now
    const now = new Date();
    const daysFromNow = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // If the date is today or in the past, get current weather
    if (daysFromNow <= 0) {
      const data = await fetchWeatherJson(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );
      if (!data) return null;

      return {
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        location: data.name,
        humidity: data.main?.humidity,
        precipitationProbability: Math.round(((data.rain?.['1h'] || 0) > 0 ? 100 : 0)),
        windSpeed: data.wind?.speed,
      };
    }

    // For future dates within 5 days, use the 5-day forecast
    if (daysFromNow <= 5) {
      const data = await fetchWeatherJson(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );
      if (!data) return null;

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
        humidity: closestForecast.main?.humidity,
        precipitationProbability: Math.round((closestForecast.pop || 0) * 100),
        windSpeed: closestForecast.wind?.speed,
      };
    }

    // For dates beyond 5 days, return a generic message
    // (Free OpenWeather API doesn't support long-range forecasts)
    return {
      temp: 25, // Default temperature
      condition: 'Clear',
      description: 'Weather forecast not available for dates beyond 5 days',
      location: 'Unknown',
      humidity: 55,
      precipitationProbability: 10,
      windSpeed: 2,
    };

  } catch (error) {
    return null;
  }
}

/**
 * Fetches and aggregates a practical 7-day forecast from OpenWeather data.
 *
 * OpenWeather free tier exposes 5-day / 3-hour forecast. We aggregate into daily
 * outlooks and project the last known pattern for days 6-7 so the planner can
 * still reason about a full week.
 */
export async function fetchWeeklyWeatherForecast(
  latitude?: number,
  longitude?: number
): Promise<WeeklyWeatherForecast | null> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return null;

    const { lat, lon } = getDefaultCoordinates(latitude, longitude);

    const fetchWeatherJson = async (url: string) => {
      if (!featureFlags.externalRetryWrapper) {
        const response = await fetch(url);
        if (!response.ok) return null;
        return response.json();
      }

      return executeWithTimeoutAndRetry(
        async (signal) => {
          const response = await fetch(url, { signal });
          if (!response.ok) {
            const error = new Error(`OpenWeather request failed: ${response.status}`) as Error & { status?: number };
            error.status = response.status;
            throw error;
          }
          return response.json();
        },
        {
          timeoutMs: 5000,
          retries: 1,
          operationName: 'openweather.weekly',
        }
      );
    };

    const [currentData, forecastData] = await Promise.all([
      fetchWeatherJson(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
      fetchWeatherJson(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
    ]);

    if (!forecastData?.list || !Array.isArray(forecastData.list)) {
      return null;
    }

    const timezoneOffsetSeconds = Number(forecastData.city?.timezone || 0);
    const currentWeather: WeatherData | undefined = currentData
      ? {
          temp: Math.round(currentData.main?.temp ?? 25),
          condition: currentData.weather?.[0]?.main || 'Clear',
          description: currentData.weather?.[0]?.description || 'clear sky',
          location: currentData.name,
          humidity: currentData.main?.humidity,
          precipitationProbability: Math.round(((currentData.rain?.['1h'] || 0) > 0 ? 100 : 0)),
          windSpeed: currentData.wind?.speed,
        }
      : undefined;

    const days = aggregateForecastToDaily(
      forecastData.list as OpenWeatherForecastEntry[],
      timezoneOffsetSeconds,
      currentWeather
    );

    return {
      location: forecastData.city?.name || currentData?.name,
      generatedAt: new Date().toISOString(),
      days,
      trendSummary: buildTrendSummary(days),
    };
  } catch {
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
