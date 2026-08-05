export const PRIVACY_POLICY = {
  version: '1.0.0',
  lastUpdated: 'August 3, 2026',
  sections: [
    {
      id: 'commitment',
      title: '1. Our Commitment to Patient Privacy',
      content: `At PharmFindr we take patient privacy and medical data protection with the utmost seriousness. We comply fully with the Ghana Data Protection Act 2012 (Act 843), international Patient Health Information (PHI) privacy guidelines, and global data safety standards.

This Privacy Policy explains how we collect, use, store, encrypt, and safeguard your personal and medical information when you interact with the PharmFindr Application.`,
    },
    {
      id: 'collection',
      title: '2. Information We Collect',
      content: `We collect only the minimum necessary information required to provide instant pharmacy discovery, safety checks, and reservation services:

• PERSONAL IDENTIFICATION: Full Name, Phone Number, Email Address, and Profile Avatar photo.
• HEALTH & MEDICAL PROFILE DATA: Allergies, chronic health conditions, age, weight, and current medications (provided voluntarily for drug safety interaction warnings).
• PRESCRIPTION IMAGES & OCR TEXT: Photos of prescription slips captured via the camera or uploaded from your library for AI extraction.
• LOCATION & TELEMETRY DATA: Real-time GPS coordinates (when permission is granted) used solely to calculate distances to nearby pharmacies and route navigation.
• DEVICE & SECURITY DATA: Unique device identifiers, IP addresses, active login session logs, and audit logs stored for account security.`,
    },
    {
      id: 'usage',
      title: '3. How We Use Your Data',
      content: `Your data is utilized strictly for essential healthcare and platform services:

• PHARMACY SEARCH & NAVIGATION: To locate licensed retail pharmacies carrying your requested medicine within your immediate geographic radius.
• AI PRESCRIPTION PARSING: To process prescription images using encrypted, ephemeral AI models (Google Gemini API) to identify medication names and dosages.
• ALLERGY & DRUG INTERACTION SAFETY: To warn you if a searched or scanned medicine presents potential conflicts with your saved health profile allergies.
• IMMUTABLE AUDIT LOGGING: To track sensitive PHI events (such as prescription scans, reservations, or password changes) in compliance with health auditing regulations.`,
    },
    {
      id: 'encryption',
      title: '4. Data Encryption & Storage Security',
      content: `• ENCRYPTION IN TRANSIT: All data transmitted between your device, PharmFindr servers, and Supabase cloud infrastructure is encrypted using Transport Layer Security (TLS 1.3).
• ENCRYPTION AT REST: Patient databases and prescription file stores are protected with AES-256 military-grade encryption.
• ROW LEVEL SECURITY (RLS): Supabase database policies restrict access to patient records so that ONLY your authenticated user account can view your personal health profile and prescription history.`,
    },
    {
      id: 'rights',
      title: '5. Your Rights & Session Management',
      content: `As a PharmFindr patient, you possess full ownership and control over your personal data:

• ACCESS & EXPORT: You may view and export your profile and health parameters at any time.
• ACTIVE DEVICE MANAGEMENT: You can inspect all active device sessions logged into your account under Profile > Active Devices and manually revoke remote device logins.
• DATA DELETION: You have the right to request complete account and medical record erasure from our active databases by contacting our Data Protection Officer.`,
    },
    {
      id: 'third-parties',
      title: '6. Zero Data Monetization',
      content: `WE DO NOT SELL YOUR MEDICAL DATA: PharmFindr will NEVER sell, lease, rent, or trade your personal health information, prescription history, or location telemetry to third-party advertisers, data brokers, or insurance companies.

Data is shared strictly with selected Partner Pharmacies when you explicitly initiate a medicine reservation.`,
    },
    {
      id: 'dpo-contact',
      title: '7. Data Protection Officer (DPO) Contact',
      content: `If you have questions, concerns, or requests regarding this Privacy Policy or your medical data rights, contact our Data Protection Office:

• Email: privacy@PharmFindr.com / dpo@PharmFindr.com
• Phone / WhatsApp Support: +233 55 659 9885
• Office Address: PharmFindr Innovation Hub, Airport Residential Area, Accra, Ghana.`,
    },
  ],
};
