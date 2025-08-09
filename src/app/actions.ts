'use server';

import { z } from 'zod';

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
