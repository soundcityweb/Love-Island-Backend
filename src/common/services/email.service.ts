import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Initialize email transporter if SMTP config is provided
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('Email service initialized with SMTP configuration');
    } else {
      this.logger.warn(
        'Email service not configured. SMTP credentials not found. Emails will be logged only.',
      );
    }
  }

  /**
   * Send approval email to applicant when they become an islander
   */
  async sendApprovalEmail(
    to: string,
    firstName: string,
    lastName: string,
    profileSlug: string,
  ): Promise<void> {
    const subject = "You're In! Welcome to Love Island Nigeria";
    const profileUrl = this.getProfileUrl(profileSlug);
    const html = this.getApprovalEmailTemplate(firstName, lastName, profileUrl);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      this.logger.debug(`Email content:\n${html}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to,
        subject,
        html,
      });

      this.logger.log(`Approval email sent successfully to ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send approval email to ${to}:`, error);
      throw error;
    }
  }

  private getProfileUrl(slug: string): string {
    const base = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3001';
    return `${base.replace(/\/$/, '')}/islanders/${slug}`;
  }

  private getAdminApplicationReviewUrl(applicationId: string): string {
    const base = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3001';
    return `${base.replace(/\/$/, '')}/admin/applications/${applicationId}`;
  }

  /**
   * Send notification to admin(s) when a new application is submitted
   */
  async sendNewApplicationNotificationToAdmin(
    applicationId: string,
    applicantFirstName: string,
    applicantLastName: string,
  ): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmails?.trim()) {
      this.logger.debug('ADMIN_EMAIL not configured; skipping new application notification');
      return;
    }

    const toList = adminEmails.split(',').map((e) => e.trim()).filter(Boolean);
    if (toList.length === 0) return;

    const subject = 'New Application Submitted - Love Island Nigeria';
    const reviewUrl = this.getAdminApplicationReviewUrl(applicationId);
    const html = this.getNewApplicationNotificationTemplate(
      applicantFirstName,
      applicantLastName,
      reviewUrl,
    );

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${toList.join(', ')}, Subject: ${subject}`);
      this.logger.debug(`Email content:\n${html}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to: toList.join(', '),
        subject,
        html,
      });
      this.logger.log(`New application notification sent to admin(s). MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Failed to send new application notification to admin:', error);
      throw error;
    }
  }

  private getNewApplicationNotificationTemplate(
    firstName: string,
    lastName: string,
    reviewUrl: string,
  ): string {
    const fullName = `${firstName} ${lastName}`;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Application - Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #1565c0; margin-top: 0;">New Application Submitted</h1>
    
    <p>A new contestant application has been submitted for Love Island Nigeria.</p>
    
    <p><strong>Applicant:</strong> ${fullName}</p>
    
    <p style="margin: 24px 0;">
      <a href="${reviewUrl}" style="display: inline-block; background-color: #1565c0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Application</a>
    </p>
    
    <p style="font-size: 12px; color: #666;">
      This is an automated notification. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  private getApprovalEmailTemplate(firstName: string, lastName: string, profileUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2e7d32; margin-top: 0;">Congratulations! You're In!</h1>
    
    <p>Dear ${firstName} ${lastName},</p>
    
    <p>We are thrilled to let you know that your application has been <strong>approved</strong>. You are officially an Islander on Love Island Nigeria!</p>
    
    <p>Your profile is now live. You can view it and share it with your fans here:</p>
    
    <p style="margin: 24px 0;">
      <a href="${profileUrl}" style="display: inline-block; background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Profile</a>
    </p>
    
    <p>Get ready for the villa. We'll be in touch with next steps and important details.</p>
    
    <p style="margin-top: 30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Team</strong>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #666;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send rejection email to applicant
   */
  async sendRejectionEmail(
    to: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const subject = 'Application Update - Love Island Nigeria';
    const html = this.getRejectionEmailTemplate(firstName, lastName);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      this.logger.debug(`Email content:\n${html}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to,
        subject,
        html,
      });

      this.logger.log(`Rejection email sent successfully to ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send rejection email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Notify a newsletter subscriber that a new article was published.
   */
  async sendNewArticleAlert(
    to: string,
    params: { title: string; articleUrl: string; unsubscribeUrl: string },
  ): Promise<void> {
    const subject = `New story: ${params.title} | Love Island Nigeria`;
    const html = this.getNewArticleAlertTemplate(
      params.title,
      params.articleUrl,
      params.unsubscribeUrl,
    );

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      this.logger.debug(`Email content:\n${html}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`New article alert sent to ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send new article alert to ${to}:`, error);
      throw error;
    }
  }

  private getNewArticleAlertTemplate(
    title: string,
    articleUrl: string,
    unsubscribeUrl: string,
  ): string {
    const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New article — Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #e91e63; margin-top: 0;">Fresh from the villa</h1>
    <p>There&apos;s a new article on Love Island Nigeria:</p>
    <p style="font-size: 18px; font-weight: bold;"><strong>${safeTitle}</strong></p>
    <p>
      <a href="${articleUrl}" style="display: inline-block; background: #e91e63; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold;">Read the story</a>
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">
      You signed up for news updates on our website.<br>
      <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe from these emails</a>
    </p>
  </div>
</body>
</html>
`.trim();
  }

  /**
   * Send order confirmation email to customer after order is created.
   */
  async sendOrderConfirmationEmail(
    to: string,
    params: {
      orderNumber: string;
      customerFirstName: string;
      items: Array<{
        productName: string;
        quantity: number;
        priceSnapshot: string;
        productImage: string | null;
      }>;
      subtotalAmount: string;
      couponCode: string | null;
      discountAmount: string | null;
      totalAmount: string;
      currency: string;
      shippingAddress: string;
      shippingCity: string;
      shippingState: string;
    },
  ): Promise<void> {
    const subject = `Order Confirmed — ${params.orderNumber} | Love Island Nigeria`;
    const html = this.getOrderConfirmationTemplate(params);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'orders@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Order confirmation sent to ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send order confirmation to ${to}:`, error);
    }
  }

  /**
   * Send payment success email to customer after Paystack confirms payment.
   */
  async sendPaymentSuccessEmail(
    to: string,
    params: {
      orderNumber: string;
      customerFirstName: string;
      items: Array<{
        productName: string;
        quantity: number;
        priceSnapshot: string;
        productImage: string | null;
      }>;
      subtotalAmount: string;
      couponCode: string | null;
      discountAmount: string | null;
      totalAmount: string;
      currency: string;
    },
  ): Promise<void> {
    const subject = `Payment Received — ${params.orderNumber} | Love Island Nigeria`;
    const html = this.getPaymentSuccessTemplate(params);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'orders@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Payment success email sent to ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send payment success email to ${to}:`, error);
    }
  }

  /**
   * Send shipping update email to customer when order is marked SHIPPED.
   */
  async sendShippingUpdateEmail(
    to: string,
    params: {
      orderNumber: string;
      customerFirstName: string;
      items: Array<{
        productName: string;
        quantity: number;
        priceSnapshot: string;
        productImage: string | null;
      }>;
      totalAmount: string;
      currency: string;
      trackingInfo?: string;
    },
  ): Promise<void> {
    const subject = `Your Order is on Its Way — ${params.orderNumber} | Love Island Nigeria`;
    const html = this.getShippingUpdateTemplate(params);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'orders@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Shipping update email sent to ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send shipping update email to ${to}:`, error);
    }
  }

  /**
   * Alert admin(s) when a product's stock falls at or below its low-stock threshold.
   */
  async sendLowStockAlertEmail(
    productName: string,
    currentStock: number,
  ): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmails?.trim()) return;

    const toList = adminEmails.split(',').map((e) => e.trim()).filter(Boolean);
    if (toList.length === 0) return;

    const subject = `Low Stock Alert: "${productName}" — ${currentStock} unit(s) remaining`;
    const html = this.getLowStockAlertTemplate(productName, currentStock);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${toList.join(', ')}, Subject: ${subject}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to: toList.join(', '),
        subject,
        html,
      });
      this.logger.log(`Low stock alert sent for "${productName}". MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send low stock alert for "${productName}":`, error);
    }
  }

  /**
   * Converts a stored image key/path into an absolute URL suitable for email clients.
   * Returns null when no absolute URL can be constructed (e.g. local dev with no base URL).
   */
  private resolveEmailImageUrl(storageKey: string | null): string | null {
    if (!storageKey) return null;
    if (storageKey.startsWith('https://') || storageKey.startsWith('http://')) {
      return storageKey;
    }
    const frontendBase = (
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      ''
    ).replace(/\/$/, '');
    if (storageKey.startsWith('/uploads/') || storageKey.startsWith('uploads/')) {
      if (!frontendBase) return null;
      const key = storageKey.startsWith('/') ? storageKey.slice(1) : storageKey;
      return `${frontendBase}/api/${key}`;
    }
    const cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    if (cloud) {
      return `https://res.cloudinary.com/${cloud}/image/upload/${storageKey}`;
    }
    if (frontendBase) {
      return `${frontendBase}/api/uploads/${storageKey}`;
    }
    return null;
  }

  private formatCurrency(amount: string, currency = 'NGN'): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return `${currency} ${amount}`;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  private getOrderConfirmationTemplate(params: {
    orderNumber: string;
    customerFirstName: string;
    items: Array<{
      productName: string;
      quantity: number;
      priceSnapshot: string;
      productImage: string | null;
    }>;
    subtotalAmount: string;
    couponCode: string | null;
    discountAmount: string | null;
    totalAmount: string;
    currency: string;
    shippingAddress: string;
    shippingCity: string;
    shippingState: string;
  }): string {
    const itemRows = params.items
      .map((item) => {
        const imgUrl = this.resolveEmailImageUrl(item.productImage);
        const imgCell = imgUrl
          ? `<td style="padding:8px 8px 8px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px;">
               <img src="${imgUrl}" alt="${item.productName}" width="48" height="48"
                    style="width:48px;height:48px;object-fit:cover;border-radius:6px;display:block;border:1px solid #e5e7eb;" />
             </td>`
          : `<td style="padding:8px 8px 8px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px;">
               <div style="width:48px;height:48px;background:#f3f4f6;border-radius:6px;border:1px solid #e5e7eb;"></div>
             </td>`;
        return `<tr>
          ${imgCell}
          <td style="padding:8px 4px;border-bottom:1px solid #eee;vertical-align:middle;">${item.productName}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #eee;vertical-align:middle;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0 8px 4px;border-bottom:1px solid #eee;vertical-align:middle;text-align:right;">${this.formatCurrency((parseFloat(item.priceSnapshot) * item.quantity).toFixed(2), params.currency)}</td>
        </tr>`;
      })
      .join('');

    const hasDiscount =
      params.discountAmount && parseFloat(params.discountAmount) > 0;

    const discountRow = hasDiscount
      ? `<tr>
          <td colspan="3" style="padding:6px 0;color:#15803d;">
            Discount${params.couponCode ? ` <span style="background:#dcfce7;border:1px solid #86efac;border-radius:4px;padding:1px 6px;font-family:monospace;font-size:12px;">${params.couponCode}</span>` : ''}
          </td>
          <td style="padding:6px 0;text-align:right;color:#15803d;font-weight:600;">
            &minus;${this.formatCurrency(params.discountAmount!, params.currency)}
          </td>
        </tr>`
      : '';

    const subtotalRow = hasDiscount
      ? `<tr>
          <td colspan="3" style="padding:6px 0;color:#6b7280;">Subtotal</td>
          <td style="padding:6px 0;text-align:right;color:#6b7280;">${this.formatCurrency(params.subtotalAmount, params.currency)}</td>
        </tr>`
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed — ${params.orderNumber}</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background-color:#f8f9fa;padding:30px;border-radius:8px;">
    <h1 style="color:#e91e63;margin-top:0;">Order Confirmed! 🎉</h1>
    <p>Hi ${params.customerFirstName},</p>
    <p>Thank you for your order. We&apos;ve received it and will begin processing it shortly.</p>
    <p><strong>Order Number:</strong> ${params.orderNumber}</p>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr>
          <th colspan="2" style="text-align:left;padding:8px 4px;border-bottom:2px solid #eee;">Item</th>
          <th style="text-align:center;padding:8px 4px;border-bottom:2px solid #eee;">Qty</th>
          <th style="text-align:right;padding:8px 0;border-bottom:2px solid #eee;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${subtotalRow}
        ${discountRow}
        <tr>
          <td colspan="3" style="padding:10px 0;font-weight:bold;font-size:15px;border-top:2px solid #eee;">Order Total</td>
          <td style="padding:10px 0;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #eee;">${this.formatCurrency(params.totalAmount, params.currency)}</td>
        </tr>
      </tfoot>
    </table>

    <p><strong>Shipping to:</strong><br>
    ${params.shippingAddress}, ${params.shippingCity}, ${params.shippingState}</p>

    <p style="margin-top:30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Store</strong>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
    <p style="font-size:12px;color:#666;">This is an automated message. Please do not reply.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getPaymentSuccessTemplate(params: {
    orderNumber: string;
    customerFirstName: string;
    items: Array<{
      productName: string;
      quantity: number;
      priceSnapshot: string;
      productImage: string | null;
    }>;
    subtotalAmount: string;
    couponCode: string | null;
    discountAmount: string | null;
    totalAmount: string;
    currency: string;
  }): string {
    const itemRows = params.items
      .map((item) => {
        const imgUrl = this.resolveEmailImageUrl(item.productImage);
        const imgCell = imgUrl
          ? `<td style="padding:8px 8px 8px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px;">
               <img src="${imgUrl}" alt="${item.productName}" width="48" height="48"
                    style="width:48px;height:48px;object-fit:cover;border-radius:6px;display:block;border:1px solid #e5e7eb;" />
             </td>`
          : `<td style="padding:8px 8px 8px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px;">
               <div style="width:48px;height:48px;background:#f3f4f6;border-radius:6px;border:1px solid #e5e7eb;"></div>
             </td>`;
        return `<tr>
          ${imgCell}
          <td style="padding:8px 4px;border-bottom:1px solid #eee;vertical-align:middle;">${item.productName}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #eee;vertical-align:middle;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0 8px 4px;border-bottom:1px solid #eee;vertical-align:middle;text-align:right;">${this.formatCurrency((parseFloat(item.priceSnapshot) * item.quantity).toFixed(2), params.currency)}</td>
        </tr>`;
      })
      .join('');

    const hasDiscount =
      params.discountAmount && parseFloat(params.discountAmount) > 0;

    const subtotalRow = hasDiscount
      ? `<tr>
          <td colspan="3" style="padding:6px 0;color:#6b7280;">Subtotal</td>
          <td style="padding:6px 0;text-align:right;color:#6b7280;">${this.formatCurrency(params.subtotalAmount, params.currency)}</td>
        </tr>`
      : '';

    const discountRow = hasDiscount
      ? `<tr>
          <td colspan="3" style="padding:6px 0;color:#15803d;">
            Discount${params.couponCode ? ` <span style="background:#dcfce7;border:1px solid #86efac;border-radius:4px;padding:1px 6px;font-family:monospace;font-size:12px;">${params.couponCode}</span>` : ''}
          </td>
          <td style="padding:6px 0;text-align:right;color:#15803d;font-weight:600;">
            &minus;${this.formatCurrency(params.discountAmount!, params.currency)}
          </td>
        </tr>`
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received — ${params.orderNumber}</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background-color:#f8f9fa;padding:30px;border-radius:8px;">
    <h1 style="color:#2e7d32;margin-top:0;">Payment Confirmed! ✅</h1>
    <p>Hi ${params.customerFirstName},</p>
    <p>Your payment for order <strong>${params.orderNumber}</strong> has been confirmed. We&apos;re now preparing your order for dispatch.</p>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr>
          <th colspan="2" style="text-align:left;padding:8px 4px;border-bottom:2px solid #eee;">Item</th>
          <th style="text-align:center;padding:8px 4px;border-bottom:2px solid #eee;">Qty</th>
          <th style="text-align:right;padding:8px 0;border-bottom:2px solid #eee;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${subtotalRow}
        ${discountRow}
        <tr>
          <td colspan="3" style="padding:10px 0;font-weight:bold;font-size:15px;border-top:2px solid #eee;">Order Total</td>
          <td style="padding:10px 0;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #eee;">${this.formatCurrency(params.totalAmount, params.currency)}</td>
        </tr>
      </tfoot>
    </table>

    <p>You&apos;ll receive a shipping notification once your order is on its way.</p>
    <p style="margin-top:30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Store</strong>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
    <p style="font-size:12px;color:#666;">This is an automated message. Please do not reply.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getShippingUpdateTemplate(params: {
    orderNumber: string;
    customerFirstName: string;
    items: Array<{
      productName: string;
      quantity: number;
      priceSnapshot: string;
      productImage: string | null;
    }>;
    totalAmount: string;
    currency: string;
    trackingInfo?: string;
  }): string {
    const itemRows = params.items
      .map((item) => {
        const imgUrl = this.resolveEmailImageUrl(item.productImage);
        const imgCell = imgUrl
          ? `<td style="padding:8px 8px 8px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px;">
               <img src="${imgUrl}" alt="${item.productName}" width="48" height="48"
                    style="width:48px;height:48px;object-fit:cover;border-radius:6px;display:block;border:1px solid #e5e7eb;" />
             </td>`
          : `<td style="padding:8px 8px 8px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px;">
               <div style="width:48px;height:48px;background:#f3f4f6;border-radius:6px;border:1px solid #e5e7eb;"></div>
             </td>`;
        return `<tr>
          ${imgCell}
          <td style="padding:8px 4px;border-bottom:1px solid #eee;vertical-align:middle;">${item.productName}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #eee;vertical-align:middle;text-align:center;">×${item.quantity}</td>
          <td style="padding:8px 0 8px 4px;border-bottom:1px solid #eee;vertical-align:middle;text-align:right;">${this.formatCurrency((parseFloat(item.priceSnapshot) * item.quantity).toFixed(2), params.currency)}</td>
        </tr>`;
      })
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order is on Its Way — ${params.orderNumber}</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background-color:#f8f9fa;padding:30px;border-radius:8px;">
    <h1 style="color:#7c3aed;margin-top:0;">Your Order is on Its Way! 📦</h1>
    <p>Hi ${params.customerFirstName},</p>
    <p>Your Love Island Nigeria order <strong>${params.orderNumber}</strong> has been shipped and is heading your way!</p>
    ${params.trackingInfo ? `<p><strong>Tracking info:</strong> ${params.trackingInfo}</p>` : ''}

    <h3 style="color:#374151;margin-bottom:8px;">What&apos;s in your package</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr>
          <th colspan="2" style="text-align:left;padding:8px 4px;border-bottom:2px solid #eee;">Item</th>
          <th style="text-align:center;padding:8px 4px;border-bottom:2px solid #eee;">Qty</th>
          <th style="text-align:right;padding:8px 0;border-bottom:2px solid #eee;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:10px 0;font-weight:bold;border-top:2px solid #eee;">Order Total</td>
          <td style="padding:10px 0;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #eee;">${this.formatCurrency(params.totalAmount, params.currency)}</td>
        </tr>
      </tfoot>
    </table>

    <p>You should receive it within the estimated delivery window. If you have any questions, feel free to contact us.</p>
    <p style="margin-top:30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Store</strong>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
    <p style="font-size:12px;color:#666;">This is an automated message. Please do not reply.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getLowStockAlertTemplate(productName: string, currentStock: number): string {
    const safe = productName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Low Stock Alert — ${safe}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff8e1; padding: 30px; border-radius: 8px; border: 1px solid #f59e0b;">
    <h1 style="color: #b45309; margin-top: 0;">Low Stock Alert</h1>
    <p>The following product is running low on inventory:</p>
    <p style="font-size: 18px; font-weight: bold;">${safe}</p>
    <p><strong>Current stock:</strong> ${currentStock} unit${currentStock === 1 ? '' : 's'} remaining</p>
    <p>Please restock soon to avoid losing sales.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">This is an automated notification from the Love Island Nigeria store.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Admin CMS: password was changed — notify the account email.
   */
  async sendAdminPasswordChangedNotice(to: string, ip: string): Promise<void> {
    const subject = 'Your Love Island Nigeria admin password was changed';
    const html = this.getAdminPasswordChangedTemplate(ip);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      this.logger.debug(html);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Admin password-changed notice sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password-changed notice to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Sent to the previous address after login email is updated.
   */
  async sendAdminEmailChangeAlertToOldAddress(
    previousEmail: string,
    newEmail: string,
    ip: string,
  ): Promise<void> {
    const subject = 'Your Love Island Nigeria admin email address was changed';
    const html = this.getAdminEmailChangeAlertOldTemplate(newEmail, ip);

    if (!this.transporter) {
      this.logger.log(
        `[EMAIL NOT SENT - SMTP not configured] To: ${previousEmail}, Subject: ${subject}`,
      );
      this.logger.debug(html);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to: previousEmail,
        subject,
        html,
      });
      this.logger.log(`Admin email-change alert sent to previous address`);
    } catch (error) {
      this.logger.error('Failed to send email-change alert to old address:', error);
      throw error;
    }
  }

  /**
   * Sent to the new address after it becomes the login email.
   */
  async sendAdminEmailChangeConfirmationToNewAddress(newEmail: string, ip: string): Promise<void> {
    const subject = 'Your Love Island Nigeria admin login email is active';
    const html = this.getAdminEmailChangeConfirmationNewTemplate(ip);

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${newEmail}, Subject: ${subject}`);
      this.logger.debug(html);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to: newEmail,
        subject,
        html,
      });
      this.logger.log(`Admin email-change confirmation sent to ${newEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send email-change confirmation to ${newEmail}:`, error);
      throw error;
    }
  }

  /**
   * Notify configured admin inboxes when a sensitive change happens from an unfamiliar IP.
   */
  async sendAdminSuspiciousActivityAlert(params: {
    adminEmail: string;
    action: string;
    ip: string;
    lastKnownIp: string | null;
  }): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmails?.trim()) {
      this.logger.debug('ADMIN_EMAIL not configured; skipping suspicious-activity alert');
      return;
    }

    const toList = adminEmails.split(',').map((e) => e.trim()).filter(Boolean);
    if (toList.length === 0) return;

    const subject = `[Security] Unfamiliar IP: admin ${params.action.replace(/_/g, ' ')}`;
    const html = this.getAdminSuspiciousActivityTemplate(params);

    if (!this.transporter) {
      this.logger.log(
        `[EMAIL NOT SENT - SMTP not configured] To: ${toList.join(', ')}, Subject: ${subject}`,
      );
      this.logger.debug(html);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to: toList.join(', '),
        subject,
        html,
      });
      this.logger.log('Suspicious admin activity alert sent');
    } catch (error) {
      this.logger.error('Failed to send suspicious-activity alert:', error);
      throw error;
    }
  }

  private getAdminPasswordChangedTemplate(ip: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Password Changed — Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #1565c0; margin-top: 0;">Password changed</h1>

    <p>The password for your Love Island Nigeria <strong>admin</strong> account was just changed.</p>

    <p><strong>IP address:</strong> ${this.escapeHtml(ip)}</p>

    <p>If you did not make this change, contact your security team immediately and reset access.</p>

    <p style="margin-top: 30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Team</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="font-size: 12px; color: #666;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  private getAdminEmailChangeAlertOldTemplate(newEmail: string, ip: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Email Changed — Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #c62828; margin-top: 0;">Admin login email updated</h1>

    <p>The login email for your Love Island Nigeria <strong>admin</strong> account was changed.</p>

    <p><strong>New email:</strong> ${this.escapeHtml(newEmail)}</p>
    <p><strong>IP address:</strong> ${this.escapeHtml(ip)}</p>

    <p>If you did not request this, secure your account immediately.</p>

    <p style="margin-top: 30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Team</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="font-size: 12px; color: #666;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  private getAdminEmailChangeConfirmationNewTemplate(ip: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Email Confirmed — Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2e7d32; margin-top: 0;">Email confirmed</h1>

    <p>This address is now used to sign in to the Love Island Nigeria <strong>admin</strong> panel.</p>

    <p><strong>IP address at change:</strong> ${this.escapeHtml(ip)}</p>

    <p style="margin-top: 30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Team</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="font-size: 12px; color: #666;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  private getAdminSuspiciousActivityTemplate(params: {
    adminEmail: string;
    action: string;
    ip: string;
    lastKnownIp: string | null;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert — Love Island Nigeria Admin</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff8e1; padding: 30px; border-radius: 8px; border: 1px solid #f59e0b;">
    <h1 style="color: #b45309; margin-top: 0;">Suspicious admin activity</h1>

    <p>A sensitive account action was performed from an IP that does not match the admin's last login IP.</p>

    <p><strong>Admin email:</strong> ${this.escapeHtml(params.adminEmail)}<br>
    <strong>Action:</strong> ${this.escapeHtml(params.action)}<br>
    <strong>Current IP:</strong> ${this.escapeHtml(params.ip)}<br>
    <strong>Last known login IP:</strong> ${this.escapeHtml(params.lastKnownIp ?? 'unknown')}</p>

    <p>Please review audit logs for full details.</p>

    <p style="margin-top: 30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Team</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="font-size: 12px; color: #666;">
      This is an automated security notification. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Maps ContactSubject enum values to the same labels as the public contact form. */
  private contactSubjectLabel(subjectValue: string): string {
    const labels: Record<string, string> = {
      general_inquiry: 'General Inquiry',
      support: 'Support',
      partnerships: 'Partnerships',
      media: 'Media',
      other: 'Other',
    };
    return labels[subjectValue] ?? subjectValue;
  }

  async sendContactFormAdminNotification(params: {
    id: string;
    name: string;
    email: string;
    /** ContactSubject enum value (e.g. general_inquiry) */
    subject: string;
    messagePreview: string;
    isUrgent: boolean;
  }): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmails?.trim()) {
      this.logger.debug('ADMIN_EMAIL not configured; skipping contact form notification');
      return;
    }

    const toList = adminEmails.split(',').map((e) => e.trim()).filter(Boolean);
    if (toList.length === 0) return;

    const subjectLabel = this.contactSubjectLabel(params.subject);
    const base = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3001';
    const adminUrl = `${base.replace(/\/$/, '')}/admin/contact-messages/${params.id}`;
    const subject = `${params.isUrgent ? '[Urgent] ' : ''}Contact: ${subjectLabel} — ${params.name}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New contact</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #e91e63; margin-top: 0;">New contact message</h1>
    <p><strong>From:</strong> ${this.escapeHtml(params.name)} &lt;${this.escapeHtml(params.email)}&gt;</p>
    <p><strong>Subject:</strong> ${this.escapeHtml(subjectLabel)}</p>
    <p style="white-space: pre-wrap;">${this.escapeHtml(params.messagePreview)}</p>
    <p style="margin: 24px 0;">
      <a href="${adminUrl}" style="display: inline-block; background-color: #e91e63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open in admin</a>
    </p>
    <p style="font-size: 12px; color: #666;">This is an automated notification.</p>
  </div>
</body>
</html>`.trim();

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${toList.join(', ')}, Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to: toList.join(', '),
        subject,
        html,
      });
      this.logger.log('Contact form admin notification sent');
    } catch (error) {
      // Do not throw — contact is already stored; SMTP rate limits must not fail the HTTP request.
      this.logger.error('Failed to send contact admin notification:', error);
    }
  }

  async sendContactFormAutoReply(to: string, name: string): Promise<void> {
    const subject = 'We received your message — Love Island Nigeria';
    const first = name.split(/\s+/)[0] || name;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Thanks for contacting us</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #e91e63; margin-top: 0;">Thanks for contacting us</h1>
    <p>Hi ${this.escapeHtml(first)},</p>
    <p>Thanks for contacting us, we&apos;ll get back shortly.</p>
    <p style="margin-top: 24px;">Best,<br><strong>The Love Island Nigeria Team</strong></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">This is an automated message.</p>
  </div>
</body>
</html>`.trim();

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Contact auto-reply sent to ${to}`);
    } catch (error) {
      // Do not throw — submission already succeeded; avoid 500 on Mailtrap/SMTP rate limits.
      this.logger.error(`Failed to send contact auto-reply to ${to}:`, error);
    }
  }

  async sendContactReplyToUser(
    to: string,
    recipientName: string,
    body: string,
    fromLabel?: string,
  ): Promise<void> {
    const subject = 'Re: Your message to Love Island Nigeria';
    const first = recipientName.split(/\s+/)[0] || recipientName;
    const signed = fromLabel?.trim() || 'Love Island Nigeria Support';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reply from Love Island Nigeria</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #3A82A6; margin-top: 0;">Message from our team</h1>
    <p>Hi ${this.escapeHtml(first)},</p>
    <div style="white-space: pre-wrap; margin: 16px 0;">${this.escapeHtml(body)}</div>
    <p style="margin-top: 24px;">— ${this.escapeHtml(signed)}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">Love Island Nigeria</p>
  </div>
</body>
</html>`.trim();

    if (!this.transporter) {
      this.logger.log(`[EMAIL NOT SENT - SMTP not configured] To: ${to}, Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loveislandnigeria.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Contact reply sent to ${to}`);
    } catch (error) {
      // Reply row is already saved; log only so admin UI does not 500 on SMTP limits.
      this.logger.error(`Failed to send contact reply to ${to}:`, error);
    }
  }

  private getRejectionEmailTemplate(firstName: string, lastName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Update - Love Island Nigeria</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #d32f2f; margin-top: 0;">Thank You for Your Application</h1>
    
    <p>Dear ${firstName} ${lastName},</p>
    
    <p>Thank you for your interest in Love Island Nigeria and for taking the time to submit your application.</p>
    
    <p>After careful consideration, we regret to inform you that we are unable to proceed with your application at this time. This decision was not made lightly, and we appreciate the effort you put into your submission.</p>
    
    <p>We received many outstanding applications, and the selection process was highly competitive. We encourage you to stay connected with us and consider applying again in the future.</p>
    
    <p>We wish you all the best in your future endeavors.</p>
    
    <p style="margin-top: 30px;">
      Best Regards,<br>
      <strong>The Love Island Nigeria Team</strong>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #666;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }
}
