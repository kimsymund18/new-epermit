const mysql = require("mysql2/promise");

const db = mysql.createPool({

    host: "localhost",

    user: "root",

    password: "root123",

    database: "new_e-permit",

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0

});

module.exports = db;