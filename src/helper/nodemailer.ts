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
    .replace("[button navigate link]", `${process.env.CLIENT_URL}/login`);

  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: "Welcome to Evently!",
    html: customizedHtml,
    attachments: [
      {
        filename: "main_logo.png",
        path: path.join(__dirname, "../emails/assets/main_logo.png"),
        cid: "companyLogo",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error while sending welcome email:", error);
  }
};

export const sendOtpToEmail = async (
  email: string,
  otp: number,
  name: string
) => {
  const emailOtpTemplate = fs.readFileSync(
    path.join(__dirname, "../emails/otp-verification-email-template.html"),
    "utf-8"
  );

  const customizedHtml = emailOtpTemplate
    .replace("[Recipient Name]", name)
    .replace("[(OTP)]", String(otp))
    .replace("[home page link]", `${process.env.CLIENT_URL1}`);

  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to Evently!",
    html: customizedHtml,
    attachments: [
      {
        filename: "main_logo.png",
        path: path.join(__dirname, "../emails/assets/main_logo.png"),
        cid: "companyLogo",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error while sending welcome email:", error);
  }
};

export const sendOtpForEmailChange = async (
  email: string,
  otp: number,
  name: string
) => {
  const emailOtpTemplate = fs.readFileSync(
    path.join(__dirname, "../emails/otp-verification-email-template.html"),
    "utf-8"
  );

  const customizedHtml = emailOtpTemplate
    .replace("[Recipient Name]", name)
    .replace("[(OTP)]", String(otp))
    .replace("[home page link]", `${process.env.CLIENT_URL}`);

  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to Evently!",
    html: customizedHtml,
    attachments: [
      {
        filename: "main_logo.png",
        path: path.join(__dirname, "../emails/assets/main_logo.png"),
        cid: "companyLogo",
      },
    ],
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

// CONTACT US - SYSTEM TO USER
export const sendContactConfirmationEmail = async (
  email: string,
  name: string,
  subject: string
) => {
  try {
    const emailTemplate = fs.readFileSync(
      path.join(__dirname, "../emails/contact-confirmation.html"),
      "utf-8"
    );

    const customizedHtml = emailTemplate
      .replace(/\[User's Name\]/g, name)
      .replace(/\[Subject\]/g, subject)
      .replace("[home page link]", `${process.env.CLIENT_URL}`);

    const mailOptions = {
      from: `Evently Support <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `We've received your message: ${subject}`,
      html: customizedHtml,
      attachments: [
        {
          filename: "main_logo.png",
          path: path.join(__dirname, "../emails/assets/main_logo.png"),
          cid: "companyLogo",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(
      "Error while sending email to User for Confirmation contact:",
      error
    );
  }
};

// CONTACT US - USER TO ADMIN
export const sendContactNotificationToAdmin = async (
  userEmail: string,
  userName: string,
  subject: string,
  message: string
) => {
  try {
    const emailTemplate = fs.readFileSync(
      path.join(__dirname, "../emails/contact-notification.html"), // Path to your HTML template
      "utf-8"
    );

    const customizedHtml = emailTemplate
      .replace(/\[User's Name\]/g, userName)
      .replace(/\[User's Email\]/g, userEmail)
      .replace(/\[Subject\]/g, subject)
      .replace(/\[Message\]/g, message)
      .replace("[dashboard link]", `${process.env.CLIENT_URL}`);

    const mailOptions = {
      from: `Evently Notifications <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // ADMIN EMAIL TO RECEIVE CONTACT
      subject: `New Contact Form Submission: ${subject}`,
      html: customizedHtml,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(
      "Error while sending email to Admin from User to Contact Us:",
      error
    );
  }
};

export const sendBookingConfirmationEmail = async (
  userEmail: string,
  userName: string,
  eventName: string,
  ticketType: string,
  seats: number,
  totalAmount: number,
  bookingId: string
) => {
  try {
    const emailTemplate = fs.readFileSync(
      path.join(__dirname, "../emails/booking-confirmation.html"),
      "utf-8"
    );

    const customizedHtml = emailTemplate
      .replace(/\[User's Name\]/g, userName)
      .replace(/\[Event Name\]/g, eventName)
      .replace(/\[Ticket Type\]/g, ticketType)
      .replace(/\[Number of Seats\]/g, seats.toString())
      .replace(/\[Total Amount\]/g, totalAmount.toString())
      .replace(/\[Booking ID\]/g, bookingId.toString())
      .replace("[home page link]", `${process.env.CLIENT_URL}`);

    const mailOptions = {
      from: `Evently Bookings <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Your tickets for ${eventName}`,
      html: customizedHtml,
      attachments: [
        {
          filename: "main_logo.png",
          path: path.join(__dirname, "../emails/assets/main_logo.png"),
          cid: "companyLogo",
        },
      ],
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending booking confirmation:", error);
    throw error;
  }
};

// cancel event ticket and refunc mail

export const cancelEventTicketMail = async (
  userEmail: string,
  userName: string,
  eventName: string,
  ticketId: string,
  refundAmount: string
) => {
  console.log("DATA::", userEmail, userName, eventName, ticketId, refundAmount);
  const emailTemplate = fs.readFileSync(
    path.join(__dirname, "../emails/event-cancel-email.html"), // Path to your HTML file
    "utf-8"
  );

  const customizedHtml = emailTemplate
    .replace(/\{{ticketId}}/g, ticketId)
    .replace(/\{{eventName}}/g, eventName)
    .replace(/\{{userName}}/g, userName)
    .replace(/\{{refundAmount}}/g, refundAmount);

  const mailOptions = {
    from: `Evently <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: "Ticket Cancellation",
    html: customizedHtml,
    attachments: [
      {
        filename: "main_logo.png",
        path: path.join(__dirname, "../emails/assets/main_logo.png"),
        cid: "companyLogo",
      },
    ],
  };

  try {
    console.log("DATA:: send");
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("DATA:: send", error);
    console.error("Error while sending welcome email:", error);
  }
};
