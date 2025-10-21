const express = require('express');
const router = express.Router();
const RecipientList = require('../models/RecipientList');
const { validateAddress } = require('../middleware/validation');

// Create a new recipient list
router.post('/', async (req, res, next) => {
  try {
    const { userAddress, name, description, recipients, tags } = req.body;
    
    if (!userAddress || !name || !recipients || recipients.length === 0) {
      return res.status(400).json({ 
        error: 'userAddress, name, and recipients are required' 
      });
    }

    // Validate recipients
    for (const recipient of recipients) {
      if (!recipient.address) {
        return res.status(400).json({ 
          error: 'Each recipient must have an address' 
        });
      }
    }

    const recipientList = new RecipientList({
      userAddress,
      name,
      description,
      recipients,
      tags: tags || []
    });

    await recipientList.save();

    res.status(201).json({ 
      data: recipientList 
    });
  } catch (error) {
    next(error);
  }
});

// Get all recipient lists for a user
router.get('/user/:userAddress', validateAddress, async (req, res, next) => {
  try {
    const { userAddress } = req.params;
    const { includeInactive } = req.query;
    
    const query = { userAddress };
    if (includeInactive !== 'true') {
      query.isActive = true;
    }

    const lists = await RecipientList.find(query)
      .sort({ createdAt: -1 });

    res.json({ 
      data: lists 
    });
  } catch (error) {
    next(error);
  }
});

// Get a single recipient list by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const list = await RecipientList.findById(id);
    
    if (!list) {
      return res.status(404).json({ 
        error: 'Recipient list not found' 
      });
    }

    res.json({ 
      data: list 
    });
  } catch (error) {
    next(error);
  }
});

// Update a recipient list
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, recipients, tags, isActive } = req.body;
    
    const list = await RecipientList.findById(id);
    
    if (!list) {
      return res.status(404).json({ 
        error: 'Recipient list not found' 
      });
    }

    if (name !== undefined) list.name = name;
    if (description !== undefined) list.description = description;
    if (recipients !== undefined) {
      // Validate recipients
      for (const recipient of recipients) {
        if (!recipient.address) {
          return res.status(400).json({ 
            error: 'Each recipient must have an address' 
          });
        }
      }
      list.recipients = recipients;
    }
    if (tags !== undefined) list.tags = tags;
    if (isActive !== undefined) list.isActive = isActive;

    await list.save();

    res.json({ 
      data: list 
    });
  } catch (error) {
    next(error);
  }
});

// Add recipients to a list
router.post('/:id/recipients', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipients } = req.body;
    
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ 
        error: 'recipients array is required' 
      });
    }

    const list = await RecipientList.findById(id);
    
    if (!list) {
      return res.status(404).json({ 
        error: 'Recipient list not found' 
      });
    }

    // Validate and add recipients
    for (const recipient of recipients) {
      if (!recipient.address) {
        return res.status(400).json({ 
          error: 'Each recipient must have an address' 
        });
      }
      
      // Check if recipient already exists
      const exists = list.recipients.some(r => r.address === recipient.address);
      if (!exists) {
        list.recipients.push({
          address: recipient.address,
          name: recipient.name,
          addedAt: new Date()
        });
      }
    }

    await list.save();

    res.json({ 
      data: list 
    });
  } catch (error) {
    next(error);
  }
});

// Remove a recipient from a list
router.delete('/:id/recipients/:recipientId', async (req, res, next) => {
  try {
    const { id, recipientId } = req.params;
    
    const list = await RecipientList.findById(id);
    
    if (!list) {
      return res.status(404).json({ 
        error: 'Recipient list not found' 
      });
    }

    list.recipients = list.recipients.filter(
      r => r._id.toString() !== recipientId
    );

    await list.save();

    res.json({ 
      data: list 
    });
  } catch (error) {
    next(error);
  }
});

// Delete a recipient list
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const list = await RecipientList.findById(id);
    
    if (!list) {
      return res.status(404).json({ 
        error: 'Recipient list not found' 
      });
    }

    list.isActive = false;
    await list.save();

    res.json({ 
      data: list 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
