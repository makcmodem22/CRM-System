import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { registerStudioRoutes } from './studioRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

export const prisma = new PrismaClient();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

registerStudioRoutes(app, prisma);

app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

const publicFrontendBase = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

app.post('/api/send-booking-email', async (req: Request, res: Response) => {
  const { email, clientName, className, startTime, trainerName, lessonId } = req.body;
  
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const mailOptions = {
    from: `"Brave! Yoga" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: `Підтвердження запису: ${className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 32px; font-weight: 900; margin: 0; color: #0F172A; letter-spacing: -1px;"><i style="font-family: 'Georgia', serif; color: #DDA343;">Brave!</i> Yoga</h1>
          <p style="color: #64748B; font-size: 14px; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px;">Студія твого балансу</p>
        </div>
        
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #F1F5F9;">
          <h2 style="font-size: 20px; color: #0F172A; margin-top: 0;">Привіт, ${clientName}! 👋</h2>
          <p style="font-size: 16px; color: #475569; line-height: 1.5;">Ми щасливі підтвердити ваш запис на тренування. Ваше тіло скаже вам дякую!</p>
          
          <div style="margin: 25px 0; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 20px; background-color: #F8FAFC;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding-bottom: 15px; border-bottom: 1px solid #E2E8F0;">
                  <p style="margin: 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Заняття</p>
                  <p style="margin: 4px 0 0 0; font-size: 18px; color: #0F172A; font-weight: 700;">${className}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 15px 0; border-bottom: 1px solid #E2E8F0;">
                   <p style="margin: 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Час</p>
                   <p style="margin: 4px 0 0 0; font-size: 16px; color: #0F172A; font-weight: 600;">${startTime}</p>
                </td>
              </tr>
              <tr>
                <td style="padding-top: 15px;">
                   <p style="margin: 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Тренер</p>
                   <p style="margin: 4px 0 0 0; font-size: 16px; color: #0F172A; font-weight: 600;">${trainerName}</p>
                </td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #64748B; line-height: 1.5; text-align: center; margin: 30px 0 15px 0;">
            Змінилися плани? Будь ласка, попередьте нас заздалегідь!
          </p>
          
          <div style="text-align: center;">
            <a href="${publicFrontendBase()}/cancel/${lessonId}?email=${encodeURIComponent(email || '')}" style="display: inline-block; padding: 14px 28px; background-color: #FEF2F2; color: #DC2626; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #FEE2E2;">Скасувати бронювання</a>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E2E8F0;">
          <p style="font-size: 12px; color: #94A3B8; margin: 0;">З нетерпінням чекаємо на зустріч,<br><b style="color: #64748B;">Команда Brave! Yoga</b></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/cancel-booking', async (req: Request, res: Response) => {
  const { email, clientName, className, startTime } = req.body;
  
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const mailOptions = {
    from: `"Brave! Yoga" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: `Скасування запису: ${className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 32px; font-weight: 900; margin: 0; color: #0F172A; letter-spacing: -1px;"><i style="font-family: 'Georgia', serif; color: #DDA343;">Brave!</i> Yoga</h1>
        </div>
        
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #FEE2E2;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 40px;">🥺</span>
          </div>
          <h2 style="font-size: 20px; color: #0F172A; margin-top: 0; text-align: center;">Запис скасовано</h2>
          <p style="font-size: 16px; color: #475569; line-height: 1.5; text-align: center;">Привіт, ${clientName}! Ваш запис на заняття було успішно скасовано. Сподіваємось увидітись іншим разом!</p>
          
          <div style="margin: 25px 0; border: 1px dashed #FECACA; border-radius: 12px; padding: 15px; background-color: #FEF2F2; text-align: center;">
            <p style="margin: 0; font-size: 15px; color: #991B1B; font-weight: 600;">${className}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #DC2626;">${startTime}</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Cancellation email sent' });
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    res.status(500).json({ error: 'Failed to send cancellation email' });
  }
});
app.listen(port, () => {
  console.log(`CRM Backend running at http://localhost:${port}`);
});
