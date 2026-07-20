"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_1 = __importDefault(require("pino"));
const routes_1 = __importDefault(require("./routes"));
const logger = (0, pino_1.default)({
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Socket.IO Setup
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// Middleware
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
// Rate Limiter: 150 requests per minute
const limiter = (0, express_rate_limit_1.default)({
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
app.use('/api', (0, routes_1.default)(io));
// Static Asset Serving for Production Single-Port Deployments
const fs = require('fs');
const path = require('path');
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    logger.info(`Serving static frontend dist from ${frontendDistPath}`);
    app.use(express_1.default.static(frontendDistPath));
    app.get('*', (req, res, next) => {
        if (req.url.startsWith('/api') || req.url.startsWith('/health'))
            return next();
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}
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
