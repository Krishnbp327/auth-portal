const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from both directories
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// Explicit Home Route Handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    });
});

// ==========================================
// 🛠️ BREVO HTTP API ROUTER (BYPASSES ALL CLOUD FIREWALLS)
// ==========================================
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.EMAIL_USER; // Your Gmail address (registered on Brevo as Sender)

// Helper function to dispatch emails via HTTP POST
async function sendEmailViaAPI(toEmail, subject, htmlContent) {
    if (!BREVO_API_KEY || !SENDER_EMAIL) {
        throw new Error("Missing environment variables: BREVO_API_KEY or EMAIL_USER on Render.");
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: "Secure Portal", email: SENDER_EMAIL },
            to: [{ email: toEmail }],
            subject: subject,
            htmlContent: htmlContent
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to dispatch email via Brevo API.");
    }
}

// Mock Database Arrays
let users = [];
let tempRegistrations = {}; 

function generatePassword() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// 1. ROUTE: SIGN UP
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

    tempRegistrations[phone] = {
        userData: { userId, password: generatedPassword, name, phone, email },
        otp: otp
    };

    // Simulated SMS Console output
    console.log(`\n=========================================`);
    console.log(`         📱 SMS GATEWAY SIMULATION        `);
    console.log(`=========================================`);
    console.log(`To Mobile Number     : ${phone}`);
    console.log(`Verification OTP Code: ${otp}`);
    console.log(`=========================================\n`);

    const emailBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px;">
            <h2 style="color: #007bff; margin-top: 0;">Verify Your Identity</h2>
            <p>Hello ${name},</p>
            <p>Your verification code has been successfully dispatched to your account.</p>
            <div style="font-size: 26px; font-weight: bold; background: #f4f7f6; padding: 12px; text-align: center; border-radius: 4px; letter-spacing: 6px; color: #111; margin: 20px 0;">
                ${otp}
            </div>
            <p style="font-size: 13px; color: #666;">Once verified, your permanent access login credentials will be delivered straight to this inbox.</p>
        </div>
    `;

    try {
        await sendEmailViaAPI(email, '🔒 Your Account Verification Code', emailBody);
        console.log(`[API Mail System] OTP sent successfully to: ${email}`);
        return res.json({ message: "An OTP verification code has been sent to your mobile number & email address!", phone: phone });
    } catch (error) {
        console.error("🔥 Email Gateway Failure: ", error.message);
        return res.status(500).json({ message: "API connection failed: " + error.message });
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

        const credentialsBody = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #28a745; border-radius: 8px; max-width: 500px;">
                <h2 style="color: #28a745; margin-top: 0;">Verification Completed!</h2>
                <p>Hello ${completedUser.name},</p>
                <p>Your identity confirmation is successful. Below are your final portal access credentials:</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
                    <p style="margin: 5px 0;"><strong>User ID:</strong> <code style="font-size: 14px; color: #333;">${completedUser.userId}</code></p>
                    <p style="margin: 5px 0;"><strong>6-Digit Password:</strong> <code style="font-size: 14px; color: #333;">${completedUser.password}</code></p>
                </div>
            </div>
        `;

        try {
            await sendEmailViaAPI(completedUser.email, '🎉 Verification Successful: Your Login Credentials', credentialsBody);
            console.log(`[API Mail System] Login credentials emailed to: ${completedUser.email}`);
            delete tempRegistrations[phone]; 
            
            return res.json({ message: "Account activated!", userId: completedUser.userId, password: completedUser.password });
        } catch (error) {
            console.error("🔥 Credentials Delivery Error: ", error.message);
            return res.status(500).json({ message: "Verification success, but API failed to dispatch credentials." });
        }
    } else {
        return res.status(400).json({ message: "Invalid verification code entered." });
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
