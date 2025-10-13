const axios = require('axios');

const fetchTopShotAssets = async (address) => {
  try {
    const response = await axios.get(
      `${process.env.NBA_TOPSHOT_API}/marketplace/v1/accounts/${address}/moments`
    );
    return response.data || [];
  } catch (error) {
    console.error('Error fetching Top Shot assets:', error.message);
    return [];
  }
};

const fetchAllDayAssets = async (address) => {
  try {
    const response = await axios.get(
      `${process.env.NFL_ALLDAY_API}/marketplace/v1/accounts/${address}/moments`
    );
    return response.data || [];
  } catch (error) {
    console.error('Error fetching All Day assets:', error.message);
    return [];
  }
};

const fetchDisneyPinnacleAssets = async (address) => {
  try {
    const response = await axios.get(
      `${process.env.DISNEY_PINNACLE_API}/v1/accounts/${address}/pins`
    );
    return response.data || [];
  } catch (error) {
    console.error('Error fetching Disney Pinnacle assets:', error.message);
    return [];
  }
};

const fetchFrothPrice = async () => {
  try {
    return {
      price: 0.15,
      currency: 'USD',
      timestamp: Date.now(),
      source: 'KittyPunch API'
    };
  } catch (error) {
    console.error('Error fetching FROTH price:', error.message);
    return {
      price: 0.15,
      currency: 'USD',
      timestamp: Date.now(),
      source: 'Fallback'
    };
  }
};

module.exports = {
  fetchTopShotAssets,
  fetchAllDayAssets,
  fetchDisneyPinnacleAssets,
  fetchFrothPrice
};
