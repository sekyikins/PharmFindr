export const TERMS_OF_SERVICE = {
  version: '1.0.0',
  lastUpdated: 'August 3, 2026',
  sections: [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      content: `By downloading, installing, accessing, or using the PharmFindr mobile application ("Application", "Service", or "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, you may not access or use the Application.

These Terms constitute a legally binding agreement between you ("User", "Patient", or "You") and PharmFindr Inc. ("PharmFindr", "We", "Us", or "Our").`,
    },
    {
      id: 'service-scope',
      title: '2. Scope of Service & Medical Disclaimer',
      content: `PharmFindr is a technology platform that connects patients with verified, licensed retail pharmacies ("Partner Pharmacies") to facilitate real-time medicine availability search, AI prescription reading, and medicine reservation services.

• NOT A PHARMACEUTICAL MANUFACTURER OR DIRECT SELLER: PharmFindr does not manufacture, dispense, or directly sell pharmaceutical products. All medication dispensing and fulfillment are executed solely by licensed pharmacists at Partner Pharmacies.
• NOT EMERGENCY MEDICAL CARE: PharmFindr is NOT an emergency medical service or medical advice hotline. If you are experiencing a life-threatening medical emergency, call emergency services (112 / 193 in Ghana) or visit the nearest hospital immediately.
• NO DOCTOR-PATIENT RELATIONSHIP: Information provided through the Application, including AI Assistant outputs and medicine details, is for informational purposes only and does not substitute professional medical advice, diagnosis, or treatment.`,
    },
    {
      id: 'prescriptions',
      title: '3. Prescription Medications & Verification',
      content: `• VALID PRESCRIPTIONS REQUIRED: Reservation or pick-up of Prescription-Only Medicines (POM) requires a valid, unexpired prescription issued by a licensed medical practitioner.
• VERIFICATION RIGHT: Partner Pharmacies maintain the absolute legal right and responsibility to inspect, verify, or decline any prescription slip presented if it appears forged, altered, expired, or medically questionable.
• ACCURACY OF SCANNING: While PharmFindr utilizes advanced AI OCR technology to scan handwritten prescriptions, You are responsible for reviewing extracted medication names and strengths with a pharmacist before taking any medication.`,
    },
    {
      id: 'reservations',
      title: '4. Medicine Reservations & Fulfillments',
      content: `• TEMPORARY HOLD: Submitting a medicine reservation creates a temporary inventory hold at the selected Partner Pharmacy.
• EXPIRATION OF RESERVATIONS: Reserved items that are not picked up within the specified window (typically 24–48 hours) may be automatically canceled and returned to public inventory.
• IDEMPOTENCY & LATENCY: PharmFindr implements idempotency controls to prevent double-reservations under high network latency.`,
    },
    {
      id: 'user-accounts',
      title: '5. Account Security & Biometrics',
      content: `• ACCOUNT RESPONSIBILITY: You are responsible for maintaining the confidentiality of your account credentials and biometrics settings.
• BIOMETRIC LOCK: Enabling Face ID, Touch ID, or fingerprint authentication secures local app launches on your device. You are responsible for managing authorized biometric profiles enrolled on your OS.
• PROHIBITED CONDUCT: You agree not to submit fraudulent prescriptions, impersonate medical personnel, scrap platform data, or reverse engineer any part of the Application.`,
    },
    {
      id: 'limitation',
      title: '6. Limitation of Liability',
      content: `To the maximum extent permitted by applicable law (including the Ghana Public Health Act 2012, Act 851), PharmFindr and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of, or inability to use, the Application or services dispensed by third-party Partner Pharmacies.`,
    },
    {
      id: 'governing-law',
      title: '7. Governing Law & Dispute Resolution',
      content: `These Terms shall be governed by and construed in accordance with the laws of the Republic of Ghana, without regard to its conflict of law principles. Any dispute arising out of these Terms shall be submitted to binding arbitration in Accra, Ghana.`,
    },
  ],
};
