'use server';

import nodemailer from 'nodemailer';

/**
 * @fileOverview Contact Email Transmission Action.
 * Handles the email relay node using corporate SMTP credentials.
 * Implements specific error handling for Google's Application-Specific Password requirement.
 */

export async function sendEnquiryEmail(values: { name: string; email: string; subject: string; message: string }) {
  try {
    // Registry Handshake: Using provided authorized corporate credentials
    // SECURITY NODE: Using provided 16-character App Password for sikkalmcg@gmail.com
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'sikkalmcg@gmail.com', 
        pass: 'gigy slmh ivtn grdo', 
      },
    });

    const mailOptions = {
      from: '"Sikka Registry Bot" <sikkalmcg@gmail.com>',
      to: 'sil@sikkaenterprises.com',
      subject: `[RE-REGISTRY] NEW ENQUIRY: ${values.subject}`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
          <div style="background-color: #1e3a8a; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 900; font-style: italic;">Sikka Industries</h1>
            <p style="color: #93c5fd; margin: 8px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; font-weight: 700;">Registry Transmission Node</p>
          </div>
          
          <div style="padding: 40px; color: #334155;">
            <div style="margin-bottom: 32px;">
              <p style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Enquiry Particulars</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #64748b; width: 140px;">NAME:</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${values.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #64748b;">EMAIL NODE:</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 900; color: #3b82f6;">${values.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #64748b;">SUBJECT:</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 900; color: #0f172a;">${values.subject}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #f8fafc; border-radius: 20px; padding: 24px; border: 1px solid #f1f5f9;">
              <p style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px;">Mission Details</p>
              <p style="font-size: 14px; line-height: 1.7; color: #334155; margin: 0; white-space: pre-wrap; font-weight: 500;">${values.message}</p>
            </div>
          </div>

          <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4em; margin: 0;">VERIFIED SIKKA LMC REGISTRY DOCUMENT</p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (smtpError: any) {
      // SECURITY HANDSHAKE Node: Provide clear instructions for Auth Failures
      if (smtpError.message.includes('534-5.7.9')) {
        throw new Error("APPLICATION PASSWORD REQUIRED: The registry link failed due to security policies. Ensure 'gigy slmh ivtn grdo' is currently active in Google Account Security.");
      }
      throw smtpError;
    }
  } catch (error: any) {
    console.error("Transmission Node Failure:", error);
    throw new Error(error.message || "Registry email link failure.");
  }
}
