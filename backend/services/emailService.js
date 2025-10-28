import nodemailer from 'nodemailer';

// Create transporter (using Gmail for development - you'll need to configure this)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

export const sendInvitationEmail = async (email, invitationLink, contractTitle, inviterName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: email,
      subject: `Invitation to join contract: ${contractTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Contract Invitation</h2>
          <p>Hello!</p>
          <p><strong>${inviterName}</strong> has invited you to join the contract: <strong>${contractTitle}</strong></p>
          <p>Click the link below to accept the invitation:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${invitationLink}" style="color: #2563eb;">${invitationLink}</a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This invitation will expire in 7 days.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Invitation email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return { success: false, error: error.message };
  }
};

// For development/testing - just log the invitation link
export const sendInvitationEmailDev = async (email, invitationLink, contractTitle, inviterName) => {
  console.log('=== INVITATION EMAIL (DEV MODE) ===');
  console.log('To:', email);
  console.log('Subject: Invitation to join contract:', contractTitle);
  console.log('From:', inviterName);
  console.log('Invitation Link:', invitationLink);
  console.log('=====================================');
  
  return { success: true, messageId: 'dev-mode' };
};
