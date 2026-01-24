const nodemailer = require('nodemailer');

// Create transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'macsonline500@gmail.com',
    pass: process.env.SMTP_PASS || 'fkyhjgxluajskpez',
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email service error:', error);
  } else {
    console.log('Email service ready to send messages');
  }
});

/**
 * Send password reset email
 */
exports.sendPasswordResetEmail = async (email, resetToken, userName) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"${process.env.SMTP_FROM || 'NounPaddi'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset Request - NounPaddi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            font-size: 22px;
            margin-top: 0;
          }
          .content p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .footer {
            background: #f9f9f9;
            padding: 20px 30px;
            text-align: center;
            color: #999;
            font-size: 14px;
            border-top: 1px solid #eee;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning p {
            margin: 0;
            color: #856404;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName || 'there'}!</h2>
            <p>We received a request to reset your password for your NounPaddi account.</p>
            <p>Click the button below to create a new password. This link will expire in 1 hour.</p>

            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>

            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #999;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} NounPaddi. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send welcome email to new users
 */
exports.sendWelcomeEmail = async (email, userName) => {
  const mailOptions = {
    from: `"${process.env.SMTP_FROM || 'NounPaddi'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to NounPaddi!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            font-size: 22px;
            margin-top: 0;
          }
          .content p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
          }
          .footer {
            background: #f9f9f9;
            padding: 20px 30px;
            text-align: center;
            color: #999;
            font-size: 14px;
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to NounPaddi!</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Thank you for joining NounPaddi, your academic companion for success.</p>
            <p>Start exploring course materials, practicing questions, and earning points today!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} NounPaddi. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome emails - non-critical
    return { success: false };
  }
};

/**
 * Send IT placement application confirmation email
 */
exports.sendITApplicationEmail = async (application) => {
  const currentYear = new Date().getFullYear();

  const mailOptions = {
    from: `"${process.env.SMTP_FROM || 'NounPaddi'}" <${process.env.SMTP_USER}>`,
    to: application.email,
    subject: 'IT Placement Application Received - NounPaddi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .content h2 { color: #333; font-size: 22px; margin-top: 0; }
          .content p { color: #666; font-size: 16px; line-height: 1.6; }
          .summary-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .summary-box h3 { color: #667eea; margin-top: 0; font-size: 18px; }
          .summary-item { margin: 10px 0; }
          .summary-item strong { color: #333; }
          .next-steps { background: #e7f3ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .next-steps ul { margin: 10px 0; padding-left: 20px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .warning p { margin: 0; color: #856404; font-size: 14px; }
          .footer { background: #f9f9f9; padding: 20px 30px; text-align: center; color: #999; font-size: 14px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 IT Placement Application</h1>
          </div>
          <div class="content">
            <h2>Hello ${application.fullName}!</h2>
            <p>Thank you for applying to the NounPaddi IT Placement Program. We have successfully received your application for <strong>${application.track}</strong>.</p>

            <div class="summary-box">
              <h3>Application Summary</h3>
              <div class="summary-item"><strong>Track:</strong> ${application.track}</div>
              <div class="summary-item"><strong>Experience Level:</strong> ${application.experienceLevel}</div>
              <div class="summary-item"><strong>Study Center:</strong> ${application.studyCenter}</div>
              <div class="summary-item"><strong>Preferred Duration:</strong> ${application.duration}</div>
              <div class="summary-item"><strong>Location Preference:</strong> ${application.locationPreference}</div>
            </div>

            <div class="next-steps">
              <h3 style="margin-top: 0; color: #3b82f6;">📋 What's Next?</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Our team will review your application within 3-5 business days</li>
                <li>We will match you with suitable IT placement opportunities</li>
                <li>You will receive an email with placement details and next steps</li>
                <li>Track your application status in your NounPaddi dashboard</li>
              </ul>
            </div>

            <div class="warning">
              <p><strong>📧 Note:</strong> Make sure to check your email regularly and keep your profile updated for the best placement opportunities.</p>
            </div>

            <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
            <p style="margin-top: 30px;">Best regards,<br><strong>The NounPaddi Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${currentYear} NounPaddi. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('IT Application email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending IT application email:', error);
    return { success: false };
  }
};

/**
 * Send IT placement confirmation email
 */
exports.sendITPlacementEmail = async (application) => {
  const currentYear = new Date().getFullYear();

  const mailOptions = {
    from: `"${process.env.SMTP_FROM || 'NounPaddi'}" <${process.env.SMTP_USER}>`,
    to: application.email,
    subject: 'Congratulations! IT Placement Confirmed - NounPaddi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .content h2 { color: #333; font-size: 22px; margin-top: 0; }
          .content p { color: #666; font-size: 16px; line-height: 1.6; }
          .placement-box { background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .placement-box h3 { color: #065f46; margin-top: 0; font-size: 18px; }
          .placement-item { margin: 10px 0; color: #064e3b; }
          .placement-item strong { color: #065f46; }
          .next-steps { background: #e7f3ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .next-steps ol { margin: 10px 0; padding-left: 20px; color: #666; line-height: 1.8; }
          .footer { background: #f9f9f9; padding: 20px 30px; text-align: center; color: #999; font-size: 14px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Placement Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Congratulations ${application.fullName}!</h2>
            <p>We are excited to inform you that you have been successfully placed for your IT training!</p>

            <div class="placement-box">
              <h3>📍 Placement Details</h3>
              <div class="placement-item"><strong>Company/Organization:</strong> ${application.placementCompany || 'To be confirmed'}</div>
              <div class="placement-item"><strong>Track:</strong> ${application.track}</div>
              ${application.placementDetails ? `<div class="placement-item"><strong>Details:</strong> ${application.placementDetails}</div>` : ''}
            </div>

            <div class="next-steps">
              <h3 style="margin-top: 0; color: #3b82f6;">📋 Next Steps:</h3>
              <ol>
                <li>Check your dashboard for detailed placement information</li>
                <li>Prepare required documents (if any)</li>
                <li>Our team will contact you with onboarding details</li>
                <li>Start your IT journey!</li>
              </ol>
            </div>

            <p>We wish you all the best in your IT training. Make the most of this opportunity!</p>
            <p style="margin-top: 30px;">Best regards,<br><strong>The NounPaddi Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${currentYear} NounPaddi. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('IT Placement confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending IT placement email:', error);
    return { success: false };
  }
};

/**
 * Send project consultation request email to support inbox
 */
exports.sendConsultationRequest = async (payload) => {
  const {
    fullName,
    email,
    phone,
    department,
    projectTitle,
    issueSummary,
    preferredDate,
    preferredTime,
    paymentReference,
    userId,
  } = payload;

  const mailOptions = {
    from: `"${process.env.SMTP_FROM || 'NounPaddi'}" <${process.env.SMTP_USER}>`,
    to: 'macsonline500@gmail.com',
    subject: `New Project Consultation Request - ${fullName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0;">
        <div style="max-width: 640px; margin: 24px auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
          <h2 style="margin-top: 0; color: #0f172a;">Project Consultation Booking</h2>
          <p style="color: #475569; margin-bottom: 20px;">A student has paid and submitted a consultation request.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b;">Name</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${fullName}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Email</td><td style="padding: 6px 0; color: #0f172a;">${email}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Phone</td><td style="padding: 6px 0; color: #0f172a;">${phone}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Department</td><td style="padding: 6px 0; color: #0f172a;">${department}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Project Title</td><td style="padding: 6px 0; color: #0f172a;">${projectTitle}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Preferred Date</td><td style="padding: 6px 0; color: #0f172a;">${preferredDate}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Preferred Time</td><td style="padding: 6px 0; color: #0f172a;">${preferredTime} (2 hours)</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Payment Ref</td><td style="padding: 6px 0; color: #0f172a;">${paymentReference || 'Not provided'}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">User ID</td><td style="padding: 6px 0; color: #0f172a;">${userId || 'N/A'}</td></tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #f1f5f9; border-radius: 10px;">
            <strong style="display: block; margin-bottom: 8px; color: #0f172a;">Project Issues / Goals</strong>
            <p style="margin: 0; color: #475569; line-height: 1.6;">${issueSummary}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Consultation request email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending consultation request email:', error);
    throw new Error('Failed to send consultation request email');
  }
};

module.exports.transporter = transporter;
