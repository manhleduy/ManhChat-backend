import dotenv from "dotenv";
import { transporter } from "../config/transporter.js";
import { generateOTPForEmail, verifyOTPForEmail, verifyOTPLatest, removeOTPForEmail } from "./redis/OTPpool.js";
dotenv.config();

export const sendOTPEmail = async (recipent_email) => {
  try {
    if (!recipent_email) {
      return { message: "missing required email", status: 400 };
    }

    // generate and store OTP (hashed) in Redis
    const otp = await generateOTPForEmail(recipent_email);

    const mail_config = {
      from: process.env.SMTP_USER,
      to: recipent_email,
      subject: "MANH CHAT APP OTP EMail",
      html: `
      <!DOCTYPE html>
      <html lang="en" >
      <head>
          <meta charset="UTF-8">
          <title>Manh - OTP Email Template</title>
      </head>
      <body>
          <div style="font-family: Helvetica, Arial, san-serif;min-width:1000px;overflow:auto;line-height:2">
              <div style="margin:50px auto;width:70%;padding:20px 0">
                  <div style="border-bottom:1px solid #eee">
                      <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">ManhChatApp</a>
                  </div>
                  <p style="font-size:1.1em">Hi,</p>
                  <p>Use the following OTP to complete your process, OTP is valid for 5 minutes</p>
                  <h2 style="background:#00466a;margin: 0 auto;width: max-content; padding: 0 10px;color: #fff;border-radius: 4px;">${otp}</h2>
                  <p style="font-size:0.9rem;">Regards,<br/> ManhChatApp Team</p>
                  <hr style="border:none;border-top:1px solid #eee"/>
                  <div style="float:right; padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
                      <p>Hai phong</p>
                      <p>Viet nam</p>
                  </div>
              </div>
          </div>
      </body>
      </html>
      `,
    };

    try {
      await transporter.sendMail(mail_config);
      return { message: "Email send successfully", status: 200 };
    } catch (err) {
      console.error('transporter.sendMail error:', err);
      // cleanup stored OTP on failure
      try {
        await removeOTPForEmail(recipent_email);
      } catch (cleanupErr) {
        console.error('cleanup OTP error:', cleanupErr);
      }
      return { message: "An error has occured", status: 500 };
    }
  } catch (e) {
    console.error('sendOTPEmail error:', e);
    return { message: "server error", status: 500 };
  }
};

export const verifyOTP = async (inputOTP, email) => {
  try {
    if (!inputOTP) return { message: "type in your OTP first", status: 400 };

    // If email provided, verify for that email; otherwise fallback to latest (backward compatibility)
    if (email) {
      const ok = await verifyOTPForEmail(email, inputOTP);
      if (!ok) return { message: "OTP is incorrect", status: 400 };
      return { message: "successful", status: 200 };
    }

    const okLatest = await verifyOTPLatest(inputOTP);
    if (!okLatest) return { message: "OTP is incorrect", status: 400 };
    return { message: "successful", status: 200 };
  } catch (e) {
    console.error('verifyOTP error:', e);
    return { message: "server error", status: 500 };
  }
};
