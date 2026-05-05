const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./src/config/db');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const productRoutes = require('./src/routes/productRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const sellerRoutes = require('./src/routes/sellerRoutes');

const paymentRoutes = require('./src/routes/paymentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
// const reviewRoutes = require('./src/routes/reviewRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const bannerRoutes = require('./src/routes/bannerRoutes');

// Connect to database
connectDB();

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'https://buyselling.netlify.app/'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
// app.use('/api', limiter);

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payment', paymentRoutes);

app.use('/api/seller', sellerRoutes);

app.use('/api/categories', categoryRoutes);
app.use('/api/banners', bannerRoutes);


// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';

  console.error('Error:', err);

  res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : {},
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});

module.exports = app;