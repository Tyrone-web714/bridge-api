const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Import routes
const bridgeRoutes = require('./routes/bridges');
const driverRoutes = require('./routes/drivers');
const supervisorRoutes = require('./routes/supervisors');
const routingRoutes = require('./routes/routing');

app.use('/api/bridges', bridgeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/routing', routingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
