/**
 * Batch Creator for n8n (WITH CLEANING)
 *
 * Groups matched pairs into optimal batches for AI processing.
 * Cleans runtime fields before sending to AI.
 * Target batch size: 15 pairs (configurable)
 */

// Get input data
const inputData = $input.first().json;
const matchedPairs = inputData.matched_pairs || [];
const statistics = inputData.statistics || {};

// Configuration
const BATCH_SIZE = 15;
const MAX_BATCHES = 100;

console.log(`[Batch Creator] Creating batches from ${matchedPairs.length} matched pairs`);

// Helper: Clean item for AI (remove runtime fields)
function cleanItemForAI(item) {
  // Remove top-level runtime fields
  const { checked, _index, fields, ...cleanItem } = item;

  // Clean options array (remove checked from each option)
  if (cleanItem.options && Array.isArray(cleanItem.options)) {
    cleanItem.options = cleanItem.options.map(option => {
      const { checked, ...cleanOption } = option;
      return cleanOption;
    });
  }

  return cleanItem;
}

// Clean pairs before batching
const cleanedPairs = matchedPairs.map(pair => ({
  doc1_item: cleanItemForAI(pair.doc1_item),
  doc2_item: cleanItemForAI(pair.doc2_item),
  match_score: pair.match_score,
  details: pair.details
}));

console.log(`[Batch Creator] Cleaned ${cleanedPairs.length} pairs (removed runtime fields)`);

// Create batches
const batches = [];
let currentBatch = [];
let batchNumber = 1;

cleanedPairs.forEach((pair, index) => {
  currentBatch.push(pair);

  // When batch is full or this is the last pair
  if (currentBatch.length === BATCH_SIZE || index === cleanedPairs.length - 1) {
    batches.push({
      batch_number: batchNumber,
      batch_size: currentBatch.length,
      pairs: currentBatch,
      batch_id: `batch_${batchNumber}_${Date.now()}`
    });

    currentBatch = [];
    batchNumber++;

    // Safety check
    if (batches.length >= MAX_BATCHES) {
      console.log(`[Batch Creator] WARNING: Reached max batches limit (${MAX_BATCHES})`);
      return;
    }
  }
});

console.log(`[Batch Creator] Created ${batches.length} batches`);
console.log(`[Batch Creator] Batch sizes: ${batches.map(b => b.batch_size).join(', ')}`);

// Return results as multiple items (one per batch) for n8n loop
return batches.map((batch, index) => ({
  json: {
    ...batch,
    total_batches: batches.length,
    is_first_batch: index === 0,
    is_last_batch: index === batches.length - 1,
    original_statistics: statistics,
    progress_percent: Math.round(((index + 1) / batches.length) * 100)
  }
}));
