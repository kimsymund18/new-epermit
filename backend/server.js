const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* =========================================
   DATABASE
========================================= */
require("./config/db");

/* =========================================
   SEED SUPER ADMIN
========================================= */
const createSuperAdmin = require("./seed");
createSuperAdmin();

/* =========================================
   MIDDLEWARE
========================================= */
app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

/* =========================================
   STATIC FILES
========================================= */
app.use(
    "/uploads",
    express.static(
        path.resolve(__dirname, "uploads")
    )
);

/* =========================================
   ROUTES
========================================= */

// AUTH
const authRoutes =
    require("./routes/authRoutes");

app.use(
    "/api/auth",
    authRoutes
);

// USERS
const userRoutes =
    require("./routes/userRoutes");

app.use(
    "/api/users",
    userRoutes
);

// PERMITS
const permitRoutes =
    require("./routes/permitRoutes");

app.use(
    "/api/permits",
    permitRoutes
);

// PAYMENTS
const paymentRoutes =
    require("./routes/paymentRoutes");

app.use(
    "/api/payments",
    paymentRoutes
);

// INSPECTIONS
const inspectionRoutes =
    require("./routes/inspectionRoutes");

app.use(
    "/api/inspections",
    inspectionRoutes
);

// CLEARANCE
const clearanceRoutes = 
    require("./routes/clearanceRoutes");


app.use(
    "/api/clearance", 
    clearanceRoutes);

/* =========================================
   DEFAULT ROUTE
========================================= */
app.get("/", (req, res) => {

    res.json({
        message: "BuildBillEase API Running"
    });

});

/* =========================================
   ERROR HANDLER
========================================= */
app.use((err, req, res, next) => {

    console.error(err.stack);

    res.status(500).json({
        message:
            err.message ||
            "Internal Server Error"
    });

});

/* =========================================
   SERVER
========================================= */
const PORT = 5000;

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});