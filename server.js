const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🛠️ GOOGLE EMAIL CONFIGURATION
// ==========================================
// ==========================================
// ==========================================
// 🛠️ GOOGLE EMAIL CONFIGURATION (SMTP BYPASS FOR CLOUD)
// ==========================================
const EMAIL_USER = process.env.EMAIL_USER; 
const EMAIL_PASS = process.env.EMAIL_PASS; 

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Must be false for port 587
    requireTLS: true, // Forces secure encryption
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Prevents cloud firewall handshake drops
    }
});
// Mock Database Arrays
let users = [];
let tempRegistrations = {}; 

function generatePassword() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}
// Add this block right before your signup route:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    });
});
// 1. ROUTE: SIGN UP (Requires only Name, Phone, and Email)
app.post('/api/signup', async (req, res) => {
    const { name, phone, email } = req.body;

    if (!name || !phone || !email) {
        return res.status(400).json({ message: "Please fill all required fields (Name, Phone, and Email)." });
    }

    const userId = name.toLowerCase().replace(/\s+/g, '');
    
    if (users.find(u => u.userId === userId)) {
        return res.status(400).json({ message: "A user with this name already exists. Try adding a middle/last name." });
    }

    const otp = generateOTP();
    const generatedPassword = generatePassword(); 

    // Cache registration details securely
    tempRegistrations[phone] = {
        userData: { userId, password: generatedPassword, name, phone, email },
        otp: otp
    };

    // 📱 DUAL CHANNEL 1: SIMULATED SMS OUTPUT (PowerShell console log)
    console.log(`\n=========================================`);
    console.log(`         📱 SMS GATEWAY SIMULATION        `);
    console.log(`=========================================`);
    console.log(`To Mobile Number     : ${phone}`);
    console.log(`Verification OTP Code: ${otp}`);
    console.log(`=========================================\n`);

    // 📧 DUAL CHANNEL 2: REAL EMAIL OTP DISPATCH
    const otpMailOptions = {
        from: EMAIL_USER,
        to: email,
        subject: '🔒 Your Account Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px;">
                <h2 style="color: #007bff; margin-top: 0;">Verify Your Identity</h2>
                <p>Hello ${name},</p>
                <p>Thank you for registering. Your verification code has been sent to both your registered mobile number (${phone}) and this email account.</p>
                <div style="font-size: 26px; font-weight: bold; background: #f4f7f6; padding: 12px; text-align: center; border-radius: 4px; letter-spacing: 6px; color: #111; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="font-size: 13px; color: #666;">Once verified, your permanent access login credentials will be delivered straight to this inbox.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(otpMailOptions);
        console.log(`[Email System] Verification code emailed to: ${email}`);
        res.json({ message: "An OTP verification code has been sent to your mobile number & email address!", phone: phone });
    } catch (error) {
        console.error("Email Gateway Failure: ", error);
        res.status(500).json({ message: "Failed to dispatch verification email. Please check your App Password settings." });
    }
});

// 2. ROUTE: OTP VALIDATION
app.post('/api/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;
    const record = tempRegistrations[phone];

    if (!record) {
        return res.status(400).json({ message: "Registration session expired or invalid." });
    }

    if (record.otp === otp) {
        const completedUser = record.userData;
        users.push(completedUser);

        // Prepare Credentials Email Delivery
        const credentialsMailOptions = {
            from: EMAIL_USER,
            to: completedUser.email,
            subject: '🎉 Verification Successful: Your Login Credentials',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #28a745; border-radius: 8px; max-width: 500px;">
                    <h2 style="color: #28a745; margin-top: 0;">Verification Completed!</h2>
                    <p>Hello ${completedUser.name},</p>
                    <p>Your identity confirmation is successful. Below are your final portal access credentials:</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
                        <p style="margin: 5px 0;"><strong>User ID:</strong> <code style="font-size: 14px; color: #333;">${completedUser.userId}</code></p>
                        <p style="margin: 5px 0;"><strong>6-Digit Password:</strong> <code style="font-size: 14px; color: #333;">${completedUser.password}</code></p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(credentialsMailOptions);
            console.log(`[Email System] Access credentials successfully delivered to: ${completedUser.email}`);
            delete tempRegistrations[phone]; 
            
            res.json({ message: "Account activated!", userId: completedUser.userId, password: completedUser.password });
        } catch (error) {
            console.error("Credentials Delivery Error: ", error);
            res.status(500).json({ message: "Profile verified but failed to dispatch credentials email." });
        }
    } else {
        res.status(400).json({ message: "Invalid verification code entered." });
    }
});

// 3. ROUTE: SIGN IN
app.post('/api/signin', (req, res) => {
    const { userId, password } = req.body;
    const user = users.find(u => u.userId === userId && u.password === password);

    if (user) {
        res.json({ message: "Access authorization granted!", user: { name: user.name, userId: user.userId } });
    } else {
        res.status(401).json({ message: "Authentication failed. Invalid User ID or Password." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server environment securely operational on port ${PORT}`));
