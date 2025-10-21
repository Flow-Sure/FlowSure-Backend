const validateAddress = (req, res, next) => {
  const address = req.params.address || req.params.userAddress || req.body.user;
  
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  if (!address.startsWith('0x') || address.length < 18) {
    return res.status(400).json({ error: 'Invalid Flow address format' });
  }

  next();
};

const validateStakeAmount = (req, res, next) => {
  const { amount } = req.body;
  
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  next();
};

const validateAssetType = (req, res, next) => {
  const { assetType } = req.body;
  const validTypes = ['NBA_TOP_SHOT', 'NFL_ALL_DAY', 'DISNEY_PINNACLE'];
  
  if (!assetType || !validTypes.includes(assetType)) {
    return res.status(400).json({ 
      error: 'Invalid asset type. Must be one of: NBA_TOP_SHOT, NFL_ALL_DAY, DISNEY_PINNACLE' 
    });
  }

  next();
};

module.exports = {
  validateAddress,
  validateStakeAmount,
  validateAssetType
};
