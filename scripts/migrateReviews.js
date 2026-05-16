require('dotenv').config();
const mongoose = require('mongoose');
const Review = require('../src/models/Review');

const migrateReviews = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Review.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'approved' } }
    );

    console.log(`Updated ${result.modifiedCount} reviews to approved status`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateReviews();
