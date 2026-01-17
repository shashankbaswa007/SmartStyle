#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

async function verifyWeatherSetup() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   Weather API Setup Verification              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Check API key
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENWEATHER_API_KEY not found in .env.local\n');
    return;
  }
  console.log('✅ API Key configured\n');

  // Test with Hyderabad coordinates
  const lat = 17.3850;
  const lon = 78.4867;

  console.log('Testing with Hyderabad coordinates:');
  console.log(`  Latitude:  ${lat}`);
  console.log(`  Longitude: ${lon}\n`);

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Weather API Response:\n');
      console.log(`   Location: ${data.name}, ${data.sys.country}`);
      console.log(`   Temperature: ${data.main.temp}°C`);
      console.log(`   Conditions: ${data.weather[0].description}`);
      console.log(`   Humidity: ${data.main.humidity}%\n`);
      
      console.log('✅ WEATHER API IS WORKING CORRECTLY!\n');
      console.log('If you\'re seeing wrong location in the app:');
      console.log('→ Enable browser location permission');
      console.log('→ Check browser console for logs');
      console.log('→ See WEATHER_TROUBLESHOOTING.md for detailed help\n');
    } else {
      console.log(`❌ API Error: ${response.status} ${response.statusText}\n`);
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}\n`);
  }
}

verifyWeatherSetup();
