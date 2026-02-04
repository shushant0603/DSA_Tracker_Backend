const nodemailer = require('nodemailer');

// Create transporter for sending emails
const createTransporter = () => {
  console.log("📧 DEBUG CONFIG:", {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER ? "Set" : "Not Set",
    pass: process.env.EMAIL_PASSWORD ? "Set" : "Not Set"
  });

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587, // Ensure this is 587 in .env
    secure: false, // 587 ke liye ye False hi hona chahiye
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false // Cloud server SSL issues fix karne ke liye
    }
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, name) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'DSA Tracker',
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: '🔐 Verify Your DSA Tracker Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <tr>
              <td>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                    🚀 DSA Tracker
                  </h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                    Your journey to mastering DSA starts here!
                  </p>
                </div>
                
                <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px;">
                    Hey ${name}! 👋
                  </h2>
                  
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                    Thanks for signing up! To complete your registration, please use the verification code below:
                  </p>
                  
                  <div style="background: linear-gradient(135deg, #f6f8fb 0%, #e9ecef 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 25px 0;">
                    <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                      Your Verification Code
                    </p>
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">
                      ${otp}
                    </div>
                  </div>
                  
                  <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                    ⏰ This code will expire in <strong>10 minutes</strong>.
                  </p>
                  
                  <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 15px 0 0 0;">
                    If you didn't create an account with DSA Tracker, you can safely ignore this email.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  
                  <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 0;">
                    © 2026 DSA Tracker. Built with @shushant0603 for developers.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'DSA Tracker',
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: '🎉 Welcome to DSA Tracker!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <tr>
              <td>
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                    🎉 Welcome to DSA Tracker!
                  </h1>
                </div>
                
                <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px;">
                    Congratulations, ${name}! 🚀
                  </h2>
                  
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                    Your account has been verified successfully! You're now ready to start your DSA mastery journey.
                  </p>
                  
                  <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">What you can do now:</h3>
                    <ul style="color: #4a5568; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                      <li>📝 Add and track your DSA questions</li>
                      <li>📊 View your progress statistics</li>
                      <li>🔄 Schedule revision reminders</li>
                      <li>💻 Practice in the code playground</li>
                    </ul>
                  </div>
                  
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  
                  <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 0;">
                    © 2026 DSA Tracker. Built with @shushant0603 for developers.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendWelcomeEmail,
};
