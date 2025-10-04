import mongoose from 'mongoose';

// Counter collection for auto-incrementing IDs
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

// Check if model already exists
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

/**
 * Get next ID for a given collection
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<number>} Next ID
 */
export async function getNextId(collectionName) {
  try {
    console.log(`Getting next ID for collection: ${collectionName}`);
    
    // Use direct MongoDB operations to avoid Mongoose schema issues
    const db = mongoose.connection.db;
    const countersCollection = db.collection('counters');
    
    const result = await countersCollection.findOneAndUpdate(
      { _id: collectionName },
      { $inc: { sequence_value: 1 } },
      { 
        returnDocument: 'after',
        upsert: true
      }
    );
    
    console.log(`Counter result:`, result);
    console.log(`Sequence value:`, result?.sequence_value);
    
    if (!result) {
      console.error(`Counter is null for ${collectionName}`);
      return 1; // Fallback to 1
    }
    
    // Check if sequence_value is a valid number
    if (typeof result.sequence_value !== 'number' || isNaN(result.sequence_value)) {
      console.error(`Invalid sequence_value for ${collectionName}:`, result.sequence_value);
      return 1; // Fallback to 1
    }
    
    return result.sequence_value;
  } catch (error) {
    console.error(`Error getting next ID for ${collectionName}:`, error);
    return 1; // Fallback to 1
  }
}

/**
 * Reset counter for a collection (useful for testing)
 * @param {string} collectionName - Name of the collection
 * @param {number} value - Starting value (default: 0)
 */
export async function resetCounter(collectionName, value = 0) {
  try {
    await Counter.findByIdAndUpdate(
      collectionName,
      { sequence_value: value },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Error resetting counter for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get current counter value
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<number>} Current counter value
 */
export async function getCurrentCounter(collectionName) {
  try {
    const counter = await Counter.findById(collectionName);
    return counter ? counter.sequence_value : 0;
  } catch (error) {
    console.error(`Error getting current counter for ${collectionName}:`, error);
    return 0;
  }
}
