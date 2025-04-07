import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import * as sgMail from '@sendgrid/mail';
import PDFDocument from 'pdfkit';

// Initialize Firebase
initializeApp();
const db = getFirestore();
const storage = getStorage().bucket('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');
sgMail.setApiKey('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');

interface ReportData {
    patientInfo: {
      name: string;
      email: string;
      age: number;
    };
    timestamp: FirebaseFirestore.Timestamp;
    heartRate: { avg: number };
    temperature: { avg: number };
    spO2: { avg: number };
    assessment: string;
  }

export const processmedicalreport = onDocumentCreated(
  'reports/{reportId}',
  async (event) => {
    const snapshot = event.data;
    const reportId = event.params.reportId;

    if (!snapshot) {
      logger.error('No data associated with the event');
      return;
    }

    const report = snapshot.data() as ReportData;

    try {
      // 1. Generate PDF
      const pdfBuffer = await generatePDF(report, reportId);
      
      // 2. Upload to Storage
      const pdfUrl = await uploadPDF(pdfBuffer, reportId);
      
      // 3. Update Firestore with PDF URL
      await snapshot.ref.update({ pdfUrl });
      
      // 4. Send Email
      await sendReportEmail(report, pdfUrl, reportId);
      
      return;
    } catch (error) {
      logger.error('Error processing report:', error);
      return;
    }
  }
);

async function generatePDF(report: ReportData, reportId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Uint8Array[] = [];
    
    // PDF Content
    doc.fontSize(18).text('Medical Report', { align: 'center' });
    doc.moveDown(0.5);
    
    // Patient Info
    doc.fontSize(12)
      .text(`Patient Name: ${report.patientInfo.name}`, { align: 'left' })
      .text(`Age: ${report.patientInfo.age}`, { align: 'left' })
      .text(`Report ID: ${reportId}`, { align: 'left' })
      .text(`Date: ${report.timestamp.toDate().toLocaleString()}`, { align: 'left' });
    
    doc.moveDown(1);
    
    // Vital Signs Table
    const vitalSigns = [
      ['Heart Rate', `${report.heartRate.avg.toFixed(0)} BPM`],
      ['Temperature', `${report.temperature.avg.toFixed(1)}°C`],
      ['Blood Oxygen', `${report.spO2.avg.toFixed(0)}%`],
    ];
    
    doc.font('Helvetica-Bold').text('Vital Signs:', 50, doc.y);
    vitalSigns.forEach(([label, value], index) => {
      doc.font('Helvetica')
        .text(label, 50, doc.y + 20 + (index * 20))
        .text(value, 250, doc.y + 20 + (index * 20));
    });
    
    doc.moveDown(2);
    
    // Medical Assessment
    doc.font('Helvetica-Bold').text('Medical Assessment:');
    doc.font('Helvetica').text(report.assessment, {
      width: 500,
      align: 'left'
    });
    
    // Finalize PDF
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

async function uploadPDF(pdfBuffer: Buffer, reportId: string): Promise<string> {
  const filePath = `medical-reports/${reportId}.pdf`;
  const file = storage.file(filePath);
  
  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000',
    },
  });
  
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491' // Long expiration
  });
  
  return url;
}

async function sendReportEmail(report: ReportData, pdfUrl: string, reportId: string) {
  const msg = {
    to: report.patientInfo.email,
    from: 'medical-reports@yourdomain.com',
    subject: `Your Medical Report #${reportId} is Ready`,
    html: `
      <h2>Hello ${report.patientInfo.name},</h2>
      <p>Your medical report dated ${report.timestamp.toDate().toLocaleDateString()} is now available.</p>
      
      <h3>Summary:</h3>
      <ul>
        <li>Heart Rate: ${report.heartRate.avg.toFixed(0)} BPM</li>
        <li>Temperature: ${report.temperature.avg.toFixed(1)}°C</li>
        <li>Blood Oxygen: ${report.spO2.avg.toFixed(0)}%</li>
      </ul>
      
      <p><strong>Medical Assessment:</strong><br>${report.assessment}</p>
      
      <p>Download your full report: <a href="${pdfUrl}">PDF Report</a></p>
      
      <p>Best regards,<br>Medical Team</p>
    `,
    attachments: [{
      content: pdfUrl.split(',')[1] || pdfUrl, // Handle base64 if needed
      filename: `medical-report-${reportId}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  };

  await sgMail.send(msg);
  console.log(`Email sent to ${report.patientInfo.email}`);
}