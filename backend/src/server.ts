import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import setupRouter from './routes';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const app = express();
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Rate Limiter: 100 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Structured logging middleware
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Setup Router
app.use('/api', setupRouter(io));

// Socket.IO namespace actions
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Socket.IO client connected');
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Socket.IO client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Backend Application Service running on port ${PORT}`);
});
