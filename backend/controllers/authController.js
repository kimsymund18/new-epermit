const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ==========================
// REGISTER
// ==========================
exports.register = async (req, res) => {

    try {

        const {
            first_name,
            middle_name,
            last_name,
            birthdate,
            contact_number,
            street_address,
            barangay,
            city,
            zip_code,
            email,
            password
        } = req.body;

        // CHECK IF EMAIL EXISTS
        const [existingUser] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if(existingUser.length > 0){
            return res.status(400).json({
                message: "Email already exists"
            });
        }

        // HASH PASSWORD
        const hashedPassword = await bcrypt.hash(password, 10);

        // INSERT INTO USERS
        const [userResult] = await db.query(
            `INSERT INTO users
            (email, password)
            VALUES (?, ?)`,
            [email, hashedPassword]
        );

        const user_id = userResult.insertId;

        // INSERT INTO APPLICANTS
        await db.query(
            `INSERT INTO applicants
            (
                user_id,
                first_name,
                middle_name,
                last_name,
                birthdate,
                contact_number,
                street_address,
                barangay,
                city,
                zip_code
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                first_name,
                middle_name,
                last_name,
                birthdate,
                contact_number,
                street_address,
                barangay,
                city,
                zip_code
            ]
        );

        res.status(201).json({
            message: "Registration successful"
        });

    } catch(error){

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    }

};


// ==========================
// LOGIN
// ==========================
exports.login = async (req, res) => {

    try {

        const { email, password } = req.body;

        // GET USER
        const [users] = await db.query(
            `SELECT 
                users.user_id,
                users.email,
                users.password,
                users.role,

                staff_profiles.department,

                applicants.first_name,
                applicants.middle_name,
                applicants.last_name,

                applicants.contact_number,

                applicants.street_address,
                applicants.barangay,
                applicants.city,
                applicants.zip_code

            FROM users

            LEFT JOIN applicants
                ON users.user_id = applicants.user_id

            LEFT JOIN staff_profiles
                ON users.user_id = staff_profiles.user_id

            WHERE users.email = ?`,
            [email]
        );

        if(users.length === 0){
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        // CHECK PASSWORD
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if(!isMatch){
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        // CREATE TOKEN
        const token = jwt.sign(
            {
                user_id: user.user_id,

                role: user.role,

                department: user.department
            },

            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.status(200).json({

            message: "Login successful",

            token,

            role: user.role,

            user: {
                user_id: user.user_id,
                email: user.email,

                role: user.role,
                department: user.department,

                first_name: user.first_name,
                middle_name: user.middle_name,
                last_name: user.last_name,

                contact_number: user.contact_number,

                street_address: user.street_address,
                barangay: user.barangay,
                city: user.city,
                zip_code: user.zip_code
            }

        });

    } catch(error){

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    }

};