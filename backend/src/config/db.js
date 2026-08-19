const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:dev_password_123@localhost:5432/armaia_nodi'
});

module.exports = pool;
