const axios = require('axios');

/**
 * Fetches the 7-day weather forecast for a given latitude and longitude.
 * @param {number} latitude - The latitude of the location.
 * @param {number} longitude - The longitude of the location.
 * @returns {Promise<Object>} A promise that resolves to the weather forecast data.
 */
async function getWeatherForecast(latitude, longitude) {
  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required to fetch weather data.');
  }

  const url = `https://api.open-meteo.com/v1/forecast`;
  const params = {
    latitude,
    longitude,
    hourly: 'temperature_2m,precipitation_probability,weathercode',
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    timezone: 'auto' // Automatically adjust to the location's timezone
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching weather forecast from Open-Meteo:', error.response ? error.response.data : error.message);
    throw new Error('Failed to fetch weather forecast.');
  }
}

/**
 * Processes the raw forecast data to generate a human-readable summary.
 * @param {Object} forecastData - The raw forecast data from Open-Meteo.
 * @returns {string} A formatted, human-readable weather summary.
 */
function getReadableForecast(forecastData) {
  if (!forecastData || !forecastData.daily) {
    return "Weather data is currently unavailable.";
  }

  const { daily } = forecastData;
  const today = daily.time[0];
  const maxTemp = daily.temperature_2m_max[0];
  const minTemp = daily.temperature_2m_min[0];
  const precipProb = daily.precipitation_probability_max[0];

  let summary = `Weather forecast for today (${today}):\n`;
  summary += `- Temperature: ${minTemp}°C to ${maxTemp}°C\n`;
  summary += `- Chance of Rain: ${precipProb}%\n\n`;
  summary += "Upcoming days:\n";

  for (let i = 1; i < 4; i++) { // Summary for the next 3 days
    if (daily.time[i]) {
      summary += `- ${daily.time[i]}: ${daily.temperature_2m_min[i]}°C to ${daily.temperature_2m_max[i]}°C, ${daily.precipitation_probability_max[i]}% chance of rain.\n`;
    }
  }

  return summary;
}

module.exports = {
  getWeatherForecast,
  getReadableForecast
};
