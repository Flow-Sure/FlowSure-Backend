const express = require('express');
const router = express.Router();
const ScheduledTransfer = require('../models/ScheduledTransfer');
const RecipientList = require('../models/RecipientList');
const { validateAddress } = require('../middleware/validation');
const { getAuthorizationTransaction, checkAuthorization } = require('../services/scheduledTransferFlowService');
const { createRecurringTransfers, cancelRecurringTransfer, calculateRecurringCost, validateRecurringBalance } = require('../services/recurringTransferService');

// Save Flow-scheduled transfer for tracking
router.post('/flow-scheduled', async (req, res, next) => {
  try {
    const { 
      userAddress, 
      title, 
      description, 
      recipient, 
      amount, 
      scheduledDate,
      transactionId
    } = req.body;
    
    if (!userAddress || !title || !amount || !scheduledDate || !recipient || !transactionId) {
      return res.status(400).json({ 
        error: 'userAddress, title, amount, scheduledDate, recipient, and transactionId are required' 
      });
    }

    const scheduledTransfer = new ScheduledTransfer({
      userAddress,
      title,
      description,
      recipient,
      amount,
      scheduledDate: new Date(scheduledDate),
      status: 'scheduled',
      transactionId,
      executionMethod: 'flow_native'
    });

    await scheduledTransfer.save();

    res.status(201).json({ 
      data: scheduledTransfer 
    });
  } catch (error) {
    next(error);
  }
});

// Create a new scheduled transfer
router.post('/', async (req, res, next) => {
  try {
    const { 
      userAddress, 
      title, 
      description, 
      recipient, 
      recipients,
      recipientListId,
      amount, 
      amountPerRecipient,
      scheduledDate, 
      retryLimit,
      isRecurring,
      recurringFrequency,
      recurringEndDate
    } = req.body;
    
    if (!userAddress || !title || !amount || !scheduledDate) {
      return res.status(400).json({ 
        error: 'userAddress, title, amount, and scheduledDate are required' 
      });
    }

    // Validate recipient(s)
    if (!recipient && (!recipients || recipients.length === 0) && !recipientListId) {
      return res.status(400).json({ 
        error: 'Either recipient, recipients array, or recipientListId is required' 
      });
    }

    // Validate scheduled date is in the future
    const schedDate = new Date(scheduledDate);
    if (schedDate <= new Date()) {
      return res.status(400).json({ 
        error: 'Scheduled date must be in the future' 
      });
    }

    let finalRecipients = recipients;
    
    // If recipientListId provided, fetch recipients from list
    if (recipientListId) {
      const recipientList = await RecipientList.findById(recipientListId);
      if (!recipientList) {
        return res.status(404).json({ 
          error: 'Recipient list not found' 
        });
      }
      finalRecipients = recipientList.recipients.map(r => ({
        address: r.address,
        name: r.name
      }));
    }

    // Handle recurring transfers
    if (isRecurring && recurringFrequency) {
      const result = await createRecurringTransfers({
        userAddress,
        title,
        description,
        recipient,
        recipients: finalRecipients,
        recipientListId,
        amount,
        amountPerRecipient: amountPerRecipient !== false,
        scheduledDate: schedDate,
        recurringFrequency,
        recurringEndDate,
        retryLimit: retryLimit || 3
      });

      return res.status(201).json({ 
        data: result.parent,
        firstInstance: result.firstInstance,
        message: 'Recurring transfer created successfully'
      });
    }

    // Create single transfer
    const scheduledTransfer = new ScheduledTransfer({
      userAddress,
      title,
      description,
      recipient,
      recipients: finalRecipients,
      recipientListId,
      amount,
      amountPerRecipient: amountPerRecipient !== false,
      scheduledDate: schedDate,
      retryLimit: retryLimit || 3,
      status: 'scheduled'
    });

    await scheduledTransfer.save();

    res.status(201).json({ 
      data: scheduledTransfer 
    });
  } catch (error) {
    next(error);
  }
});

// Get all scheduled transfers for a user
router.get('/user/:userAddress', validateAddress, async (req, res, next) => {
  try {
    const { userAddress } = req.params;
    
    const transfers = await ScheduledTransfer.find({ userAddress })
      .sort({ scheduledDate: -1 });

    res.json({ 
      data: transfers 
    });
  } catch (error) {
    next(error);
  }
});

// Get scheduled transfers for a specific month
router.get('/user/:userAddress/month', validateAddress, async (req, res, next) => {
  try {
    const { userAddress } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ 
        error: 'year and month query parameters are required' 
      });
    }

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const transfers = await ScheduledTransfer.find({
      userAddress,
      scheduledDate: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ scheduledDate: 1 });

    res.json({ 
      data: transfers 
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming scheduled transfers (next 7 days)
router.get('/user/:userAddress/upcoming', validateAddress, async (req, res, next) => {
  try {
    const { userAddress } = req.params;
    
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const transfers = await ScheduledTransfer.find({
      userAddress,
      status: 'scheduled',
      scheduledDate: {
        $gte: now,
        $lte: sevenDaysLater
      }
    }).sort({ scheduledDate: 1 });

    res.json({ 
      data: transfers 
    });
  } catch (error) {
    next(error);
  }
});

// Get a single scheduled transfer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const transfer = await ScheduledTransfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({ 
        error: 'Scheduled transfer not found' 
      });
    }

    res.json({ 
      data: transfer 
    });
  } catch (error) {
    next(error);
  }
});

// Update a scheduled transfer
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, recipient, amount, scheduledDate, retryLimit } = req.body;
    
    const transfer = await ScheduledTransfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({ 
        error: 'Scheduled transfer not found' 
      });
    }

    // Only allow updates if status is 'scheduled'
    if (transfer.status !== 'scheduled') {
      return res.status(400).json({ 
        error: 'Can only update transfers with status "scheduled"' 
      });
    }

    // Validate scheduled date if provided
    if (scheduledDate) {
      const schedDate = new Date(scheduledDate);
      if (schedDate <= new Date()) {
        return res.status(400).json({ 
          error: 'Scheduled date must be in the future' 
        });
      }
      transfer.scheduledDate = schedDate;
    }

    // Update fields
    if (title !== undefined) transfer.title = title;
    if (description !== undefined) transfer.description = description;
    if (recipient !== undefined) transfer.recipient = recipient;
    if (amount !== undefined) transfer.amount = amount;
    if (retryLimit !== undefined) transfer.retryLimit = retryLimit;

    await transfer.save();

    res.json({ 
      data: transfer 
    });
  } catch (error) {
    next(error);
  }
});

// Cancel a scheduled transfer
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const transfer = await ScheduledTransfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({ 
        error: 'Scheduled transfer not found' 
      });
    }

    // Only allow cancellation if status is 'scheduled'
    if (transfer.status !== 'scheduled') {
      return res.status(400).json({ 
        error: 'Can only cancel transfers with status "scheduled"' 
      });
    }

    transfer.status = 'cancelled';
    await transfer.save();

    res.json({ 
      data: transfer 
    });
  } catch (error) {
    next(error);
  }
});

// Get authorization transaction for frontend
router.get('/authorization-transaction', async (req, res, next) => {
  try {
    const { maxAmount, expiryDays } = req.query;
    
    if (!maxAmount || !expiryDays) {
      return res.status(400).json({ 
        error: 'maxAmount and expiryDays query parameters are required' 
      });
    }

    const transaction = getAuthorizationTransaction(
      parseFloat(maxAmount),
      parseFloat(expiryDays)
    );

    res.json({ 
      data: transaction 
    });
  } catch (error) {
    next(error);
  }
});

// Check user's authorization status
router.get('/authorization/:userAddress', validateAddress, async (req, res, next) => {
  try {
    const { userAddress } = req.params;
    
    const authStatus = await checkAuthorization(userAddress);

    res.json({ 
      data: authStatus 
    });
  } catch (error) {
    next(error);
  }
});

// Calculate recurring transfer cost
router.post('/recurring/calculate-cost', async (req, res, next) => {
  try {
    const { 
      amount, 
      amountPerRecipient, 
      recipientCount, 
      startDate, 
      frequency, 
      endDate 
    } = req.body;
    
    if (!amount || !recipientCount || !startDate || !frequency) {
      return res.status(400).json({ 
        error: 'amount, recipientCount, startDate, and frequency are required' 
      });
    }

    const cost = calculateRecurringCost(
      amount, 
      amountPerRecipient !== false, 
      recipientCount, 
      startDate, 
      frequency, 
      endDate
    );

    res.json({ 
      data: cost 
    });
  } catch (error) {
    next(error);
  }
});

// Validate balance for recurring transfer
router.post('/recurring/validate-balance', async (req, res, next) => {
  try {
    const { 
      userAddress,
      amount, 
      amountPerRecipient, 
      recipientCount, 
      startDate, 
      frequency, 
      endDate 
    } = req.body;
    
    if (!userAddress || !amount || !recipientCount || !startDate || !frequency) {
      return res.status(400).json({ 
        error: 'userAddress, amount, recipientCount, startDate, and frequency are required' 
      });
    }

    const validation = await validateRecurringBalance(
      userAddress,
      amount, 
      amountPerRecipient !== false, 
      recipientCount, 
      startDate, 
      frequency, 
      endDate
    );

    res.json({ 
      data: validation 
    });
  } catch (error) {
    next(error);
  }
});

// Cancel recurring transfer and all future instances
router.delete('/recurring/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await cancelRecurringTransfer(id);

    res.json({ 
      data: result,
      message: `Cancelled recurring transfer and ${result.cancelledInstances} future instances`
    });
  } catch (error) {
    next(error);
  }
});

// Get recurring transfer instances
router.get('/recurring/:parentId/instances', async (req, res, next) => {
  try {
    const { parentId } = req.params;
    
    const instances = await ScheduledTransfer.find({
      parentRecurringId: parentId
    }).sort({ scheduledDate: 1 });

    res.json({ 
      data: instances 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
