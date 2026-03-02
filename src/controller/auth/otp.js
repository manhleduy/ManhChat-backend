import { sendOTPEmail, verifyOTP } from "../sendEmailController.js"

/**
 * Send OTP to user email
 * @route POST /api/user/otp/send
 */
export const SendOTPEmail = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json("missing required data!");
        const result = await sendOTPEmail(email);

        if (result.status !== 200) {
            return res.status(result.status).json(result.message);
        }
        return res.status(200).json(result.message);
    } catch (e) {
        next(e);
    }
}

/**
 * Verify OTP from user
 * @route POST /api/user/otp/verify
 */
export const VerifyOTP = async (req, res, next) => {
    try {
        const { otp, email } = req.body;

        const result = await verifyOTP(otp, email);
        if (result.status !== 200) {
            return res.status(result.status).json(result.message);
        }
        return res.status(200).json(result.message);
    } catch (e) {
        next(e);
    }
}
