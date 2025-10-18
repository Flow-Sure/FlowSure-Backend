const axios = require('axios');

class NBATopShotService {
  constructor() {
    this.apiUrl = process.env.NBA_TOPSHOT_API || 'https://api.nbatopshot.com';
    this.graphqlEndpoint = `${this.apiUrl}/graphql`;
  }

  /**
   * Fetch user's NBA Top Shot moments
   * @param {string} flowAddress - User's Flow address
   * @returns {Promise<Array>} Array of moments
   */
  async getUserMoments(flowAddress) {
    const query = `
      query GetUserMoments($address: String!) {
        getUserMoments(input: { userFlowAddress: $address }) {
          data {
            moments {
              id
              flowId
              play {
                id
                stats {
                  playerName
                  teamAtMoment
                  dateOfMoment
                  playCategory
                }
                description
              }
              set {
                id
                flowName
                flowSeriesNumber
              }
              serialNumber
              price
              listingOrderID
            }
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.graphqlEndpoint, {
        query,
        variables: { address: flowAddress }
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        return [];
      }

      const moments = response.data.data?.getUserMoments?.data?.moments || [];
      return moments.map(moment => this.formatMoment(moment));
    } catch (error) {
      console.error('Error fetching NBA Top Shot moments:', error.message);
      return [];
    }
  }

  /**
   * Get moment details by ID
   * @param {string} momentId - Moment ID
   * @returns {Promise<Object>} Moment details
   */
  async getMomentDetails(momentId) {
    const query = `
      query GetMomentDetails($momentId: String!) {
        getMomentDetails(input: { momentId: $momentId }) {
          data {
            moment {
              id
              flowId
              play {
                id
                stats {
                  playerName
                  teamAtMoment
                  dateOfMoment
                  playCategory
                  playerPosition
                }
                description
              }
              set {
                id
                flowName
                flowSeriesNumber
              }
              serialNumber
              price
              listingOrderID
              owner {
                flowAddress
                username
              }
            }
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.graphqlEndpoint, {
        query,
        variables: { momentId }
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        return null;
      }

      const moment = response.data.data?.getMomentDetails?.data?.moment;
      return moment ? this.formatMoment(moment) : null;
    } catch (error) {
      console.error('Error fetching moment details:', error.message);
      return null;
    }
  }

  /**
   * Get marketplace listings
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of listings
   */
  async getMarketplaceListings(filters = {}) {
    const query = `
      query GetMarketplaceListings(
        $playerName: String
        $setName: String
        $minPrice: Float
        $maxPrice: Float
        $limit: Int
      ) {
        getMarketplaceListings(
          input: {
            filters: {
              playerName: $playerName
              setName: $setName
              minPrice: $minPrice
              maxPrice: $maxPrice
            }
            pagination: { limit: $limit }
          }
        ) {
          data {
            listings {
              id
              moment {
                id
                flowId
                play {
                  stats {
                    playerName
                    teamAtMoment
                  }
                }
                serialNumber
              }
              price
            }
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.graphqlEndpoint, {
        query,
        variables: {
          playerName: filters.playerName || null,
          setName: filters.setName || null,
          minPrice: filters.minPrice || null,
          maxPrice: filters.maxPrice || null,
          limit: filters.limit || 20
        }
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        return [];
      }

      return response.data.data?.getMarketplaceListings?.data?.listings || [];
    } catch (error) {
      console.error('Error fetching marketplace listings:', error.message);
      return [];
    }
  }

  /**
   * Format moment data
   * @param {Object} moment - Raw moment data
   * @returns {Object} Formatted moment
   */
  formatMoment(moment) {
    return {
      id: moment.id,
      flowId: moment.flowId,
      player: {
        name: moment.play?.stats?.playerName || 'Unknown',
        team: moment.play?.stats?.teamAtMoment || 'Unknown',
        position: moment.play?.stats?.playerPosition || 'Unknown'
      },
      play: {
        category: moment.play?.stats?.playCategory || 'Unknown',
        date: moment.play?.stats?.dateOfMoment || 'Unknown',
        description: moment.play?.description || ''
      },
      set: {
        id: moment.set?.id,
        name: moment.set?.flowName || 'Unknown',
        series: moment.set?.flowSeriesNumber || 0
      },
      serialNumber: moment.serialNumber,
      price: moment.price || 0,
      listingOrderID: moment.listingOrderID || null,
      isListed: !!moment.listingOrderID,
      owner: moment.owner?.flowAddress || null
    };
  }

  /**
   * Calculate moment value based on rarity and market data
   * @param {Object} moment - Moment data
   * @returns {number} Estimated value
   */
  calculateMomentValue(moment) {
    // Base value from price
    let value = moment.price || 0;

    // Adjust for serial number (lower = more valuable)
    if (moment.serialNumber <= 10) {
      value *= 2.0;
    } else if (moment.serialNumber <= 100) {
      value *= 1.5;
    } else if (moment.serialNumber <= 1000) {
      value *= 1.2;
    }

    // Adjust for set rarity
    const rareSets = ['Genesis', 'Legendary', 'Ultimate'];
    if (rareSets.some(set => moment.set.name.includes(set))) {
      value *= 1.5;
    }

    return Math.round(value * 100) / 100;
  }

  /**
   * Get protection recommendation for moment
   * @param {Object} moment - Moment data
   * @returns {Object} Protection recommendation
   */
  getProtectionRecommendation(moment) {
    const value = this.calculateMomentValue(moment);
    
    // Recommend protection for valuable moments
    if (value >= 1000) {
      return {
        recommended: true,
        reason: 'High-value moment',
        suggestedCoverage: value,
        suggestedFee: value * 0.02, // 2% of value
        priority: 'high'
      };
    } else if (value >= 100) {
      return {
        recommended: true,
        reason: 'Medium-value moment',
        suggestedCoverage: value,
        suggestedFee: value * 0.015, // 1.5% of value
        priority: 'medium'
      };
    } else {
      return {
        recommended: false,
        reason: 'Low-value moment',
        suggestedCoverage: value,
        suggestedFee: value * 0.01, // 1% of value
        priority: 'low'
      };
    }
  }

  /**
   * Get user's protected moments
   * @param {string} flowAddress - User's Flow address
   * @returns {Promise<Array>} Protected moments with status
   */
  async getProtectedMoments(flowAddress) {
    try {
      const moments = await this.getUserMoments(flowAddress);
      
      // In production, this would query the protection contract
      // For now, return moments with protection recommendations
      return moments.map(moment => ({
        ...moment,
        value: this.calculateMomentValue(moment),
        protection: this.getProtectionRecommendation(moment),
        isProtected: false, // Would check contract
        protectionId: null
      }));
    } catch (error) {
      console.error('Error getting protected moments:', error.message);
      return [];
    }
  }
}

module.exports = new NBATopShotService();
