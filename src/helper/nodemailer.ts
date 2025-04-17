import nodemailer from "nodemailer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Function to send the welcome email asynchronously
export const sendWelcomeEmail = async (userEmail: string, userName: string) => {

  const emailTemplate = fs.readFileSync(
    path.join(__dirname, "../emails/welcome-email.html"), // Path to your HTML file
    "utf-8"
  );

  const customizedHtml = emailTemplate
    .replace(/\[User's First Name\]/g, userName)
    .replace("[button navigate link]", "https://eventlyfe.netlify.app/login");

  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: "Welcome to Evently!",
    html: customizedHtml,
    attachments: [
      {
        filename: "main_logo.png",
        path: path.join(__dirname, "../emails/assets/main_logo.png"),
        cid: "companyLogo"
      },
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Welcome email sent:", info.response);
  } catch (error) {
    console.error("Error while sending welcome email:", error);
  }
};

export const sendOtpToEmail = async (email: string, otp: number, name: string) => {
  const emailOtpTemplate = fs.readFileSync(
    path.join(__dirname, "../emails/otp-verification-email-template.html"),
    "utf-8"
  );

  const customizedHtml = emailOtpTemplate
    .replace("[Recipient Name]", name)
    .replace("[(OTP)]", String(otp))
    .replace("[home page link]", "https://eventlyfe.netlify.app");

  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to Evently!",
    html: customizedHtml,
    attachments: [
      {
        filename: "main_logo.png",
        path: path.join(__dirname, "../emails/assets/main_logo.png"),
        cid: "companyLogo"
      },
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error while sending welcome email:", error);
  }
};

export const resetPasswordSuccessMail = async (email: string, name: string) => {
  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to Evently!",
    html: `<p>your password change successfully</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error while sending welcome email:", error);
  }
};