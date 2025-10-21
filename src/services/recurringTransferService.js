const ScheduledTransfer = require('../models/ScheduledTransfer');
const RecipientList = require('../models/RecipientList');

/**
 * Calculate next scheduled date based on frequency
 */
const calculateNextDate = (currentDate, frequency) => {
  const nextDate = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }
  
  return nextDate;
};

/**
 * Create recurring transfer instances
 */
const createRecurringTransfers = async (transferData) => {
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
    recurringFrequency,
    recurringEndDate,
    retryLimit 
  } = transferData;

  if (!recurringFrequency) {
    throw new Error('Recurring frequency is required');
  }

  const startDate = new Date(scheduledDate);
  const endDate = recurringEndDate ? new Date(recurringEndDate) : null;
  
  // Validate dates
  if (startDate <= new Date()) {
    throw new Error('Start date must be in the future');
  }

  if (endDate && endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  // Create parent recurring transfer (template)
  const parentTransfer = new ScheduledTransfer({
    userAddress,
    title: `${title} (Recurring)`,
    description,
    recipient,
    recipients,
    recipientListId,
    amount,
    amountPerRecipient,
    scheduledDate: startDate,
    status: 'scheduled',
    retryLimit: retryLimit || 3,
    isRecurring: true,
    recurringFrequency,
    recurringEndDate: endDate,
    nextScheduledDate: startDate
  });

  await parentTransfer.save();

  // Create first instance
  const firstInstance = new ScheduledTransfer({
    userAddress,
    title,
    description,
    recipient,
    recipients,
    recipientListId,
    amount,
    amountPerRecipient,
    scheduledDate: startDate,
    status: 'scheduled',
    retryLimit: retryLimit || 3,
    isRecurring: false,
    parentRecurringId: parentTransfer._id
  });

  await firstInstance.save();

  return {
    parent: parentTransfer,
    firstInstance
  };
};

/**
 * Generate next recurring transfer instance
 */
const generateNextInstance = async (parentId) => {
  const parent = await ScheduledTransfer.findById(parentId);
  
  if (!parent || !parent.isRecurring) {
    throw new Error('Parent recurring transfer not found');
  }

  const nextDate = calculateNextDate(parent.nextScheduledDate, parent.recurringFrequency);
  
  // Check if we've reached the end date
  if (parent.recurringEndDate && nextDate > parent.recurringEndDate) {
    console.log(`Recurring transfer ${parentId} has reached end date`);
    return null;
  }

  // Create next instance
  const nextInstance = new ScheduledTransfer({
    userAddress: parent.userAddress,
    title: parent.title.replace(' (Recurring)', ''),
    description: parent.description,
    recipient: parent.recipient,
    recipients: parent.recipients,
    recipientListId: parent.recipientListId,
    amount: parent.amount,
    amountPerRecipient: parent.amountPerRecipient,
    scheduledDate: nextDate,
    status: 'scheduled',
    retryLimit: parent.retryLimit,
    isRecurring: false,
    parentRecurringId: parent._id
  });

  await nextInstance.save();

  // Update parent's next scheduled date
  parent.nextScheduledDate = nextDate;
  await parent.save();

  return nextInstance;
};

/**
 * Cancel all future instances of a recurring transfer
 */
const cancelRecurringTransfer = async (parentId) => {
  const parent = await ScheduledTransfer.findById(parentId);
  
  if (!parent || !parent.isRecurring) {
    throw new Error('Parent recurring transfer not found');
  }

  // Cancel parent
  parent.status = 'cancelled';
  await parent.save();

  // Cancel all future instances
  const futureInstances = await ScheduledTransfer.find({
    parentRecurringId: parentId,
    status: 'scheduled',
    scheduledDate: { $gt: new Date() }
  });

  for (const instance of futureInstances) {
    instance.status = 'cancelled';
    await instance.save();
  }

  return {
    parent,
    cancelledInstances: futureInstances.length
  };
};

/**
 * Calculate total cost for recurring transfer
 */
const calculateRecurringCost = (amount, amountPerRecipient, recipientCount, startDate, frequency, endDate) => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  
  let occurrences = 0;
  let currentDate = new Date(start);
  
  // Limit to 100 occurrences to prevent infinite loops
  const maxOccurrences = 100;
  
  while (occurrences < maxOccurrences) {
    if (end && currentDate > end) {
      break;
    }
    
    occurrences++;
    currentDate = calculateNextDate(currentDate, frequency);
    
    // If no end date, calculate for 1 year
    if (!end) {
      const oneYearLater = new Date(start);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      if (currentDate > oneYearLater) {
        break;
      }
    }
  }
  
  const costPerTransfer = amountPerRecipient ? amount * recipientCount : amount;
  const totalCost = costPerTransfer * occurrences;
  
  return {
    occurrences,
    costPerTransfer,
    totalCost,
    estimatedOnly: !end
  };
};

/**
 * Validate wallet balance for recurring transfers
 */
const validateRecurringBalance = async (userAddress, amount, amountPerRecipient, recipientCount, startDate, frequency, endDate) => {
  // This would integrate with your wallet balance checking service
  // For now, we'll return the cost calculation
  
  const cost = calculateRecurringCost(amount, amountPerRecipient, recipientCount, startDate, frequency, endDate);
  
  return {
    isValid: true, // Would check actual balance here
    ...cost
  };
};

module.exports = {
  calculateNextDate,
  createRecurringTransfers,
  generateNextInstance,
  cancelRecurringTransfer,
  calculateRecurringCost,
  validateRecurringBalance
};
