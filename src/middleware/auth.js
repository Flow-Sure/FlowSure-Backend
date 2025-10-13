const authenticateWallet = async (req, res, next) => {
  const signature = req.headers['x-wallet-signature'];
  const address = req.headers['x-wallet-address'];

  if (!signature || !address) {
    return res.status(401).json({ error: 'Wallet authentication required' });
  }

  next();
};

module.exports = { authenticateWallet };
