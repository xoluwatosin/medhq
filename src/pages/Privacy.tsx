import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import KitPageHero from "@/components/kit/KitPageHero";
import { KitMain } from "@/components/kit/KitLayout";

const Privacy = () => {
  return (
    <div className="min-h-dvh bg-background">
      <SEO title="Privacy Policy | Medic Connect" description="How Medic Connect collects, uses, and protects your personal information." path="/privacy" />
      <MedicHeader />

      <KitPageHero eyebrow="Legal" title="Privacy policy" lead="Last updated 17 February 2026." />

      <KitMain>
        <div className="kit-prose mx-auto">

          {/* 1. Introduction */}
          <section>
            <h2>1. Introduction</h2>
            <p>
              Medic Connect ("we", "us", "our") is committed to protecting the privacy and security of your personal information. This Privacy Policy explains how we collect, use, store, disclose, and safeguard your information when you access or use the Medic Connect website (medicconnect.co), our Perspective blog, or any of our healthcare staffing, home care, and support services (collectively, the "Services").
            </p>
            <p>
              Medic Connect is registered in England and Wales (Company Number 15986218) and in Nigeria (RC 8026476), with its principal office at 145 Igbosere Road, Lagos Island, Lagos, Nigeria.
            </p>
            <p>
              By accessing or using our Services, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with the practices described herein, please do not use our Services.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2>2. Information we collect</h2>

            <h3>2.1 Personal information you provide</h3>
            <p>
              We collect personal information that you voluntarily provide when you interact with our Services, including but not limited to:
            </p>
            <ul>
              <li><strong>Identity and Contact Data:</strong> Full name, email address, telephone number, postal address, date of birth, and government-issued identification details.</li>
              <li><strong>Healthcare Data:</strong> Medical history, care requirements, treatment preferences, health conditions, and clinical notes necessary for the provision of home care, antenatal, postnatal, paediatric, and eldercare services.</li>
              <li><strong>Professional and Employment Data:</strong> Qualifications, professional certifications, licensure details, employment history, references, and background check results for healthcare professionals applying to join our network.</li>
              <li><strong>Financial Data:</strong> Bank account details and payment information necessary for processing payments for our Services.</li>
              <li><strong>Communications Data:</strong> Records of correspondence, including emails, contact form submissions, and enquiries submitted through our website.</li>
            </ul>

            <h3>2.2 Information collected automatically</h3>
            <p>
              When you visit our website, we automatically collect certain technical information, including:
            </p>
            <ul>
              <li>IP address and geolocation data</li>
              <li>Browser type, version, and operating system</li>
              <li>Pages visited, time spent on pages, and navigation paths</li>
              <li>Referring website addresses</li>
              <li>Device identifiers and cookies (see Section 9 below)</li>
            </ul>
          </section>

          {/* 3. Legal Basis for Processing */}
          <section>
            <h2>3. Legal basis for processing</h2>
            <p>
              We process your personal information on the following legal bases, in accordance with the Nigeria Data Protection Act 2023 (NDPA) and the UK General Data Protection Regulation (UK GDPR):
            </p>
            <ul>
              <li><strong>Consent:</strong> Where you have given clear, informed consent for us to process your personal data for specific purposes, such as subscribing to our newsletter or the Perspective blog.</li>
              <li><strong>Contractual Necessity:</strong> Where processing is necessary for the performance of a contract to which you are a party, including the provision of healthcare staffing, home care, or clinical research services.</li>
              <li><strong>Legitimate Interests:</strong> Where processing is necessary for our legitimate business interests, such as improving our Services, ensuring network security, and preventing fraud, provided such interests are not overridden by your rights and freedoms.</li>
              <li><strong>Legal Obligation:</strong> Where processing is required to comply with applicable laws, regulations, or court orders, including healthcare regulatory requirements in Nigeria and the United Kingdom.</li>
              <li><strong>Vital Interests:</strong> Where processing is necessary to protect the vital interests of a data subject, particularly in the context of emergency healthcare situations.</li>
            </ul>
          </section>

          {/* 4. How We Use Your Information */}
          <section>
            <h2>4. How we use your information</h2>
            <p>
              We use the information we collect for the following purposes:
            </p>
            <ul>
              <li>To provide, operate, and maintain our healthcare staffing, home care, hospital support, and clinical research services</li>
              <li>To match healthcare professionals with clients based on care requirements, qualifications, and availability</li>
              <li>To verify the identity, qualifications, and professional standing of healthcare professionals joining our network</li>
              <li>To process applications, enquiries, and contact form submissions</li>
              <li>To communicate with you about your care plan, appointments, and service updates</li>
              <li>To send newsletters, marketing communications, and updates from Perspective (with your consent)</li>
              <li>To process payments and manage billing</li>
              <li>To comply with legal and regulatory obligations, including healthcare licensing and reporting requirements</li>
              <li>To improve the quality, safety, and effectiveness of our Services</li>
              <li>To detect, prevent, and address fraud, security breaches, and technical issues</li>
            </ul>
          </section>

          {/* 5. Data Sharing and Disclosure */}
          <section>
            <h2>5. Data sharing and disclosure</h2>
            <p>
              We may share your personal information with the following categories of recipients:
            </p>
            <ul>
              <li><strong>Healthcare Professionals:</strong> We share relevant client information with healthcare professionals assigned to provide care, to the extent necessary for safe and effective service delivery.</li>
              <li><strong>Partner Healthcare Facilities:</strong> We may share professional data with hospitals, clinics, and research institutions for staffing placements and clinical research coordination.</li>
              <li><strong>Regulatory Bodies:</strong> We may disclose information to healthcare regulatory authorities, professional licensing bodies, and government agencies as required by law.</li>
              <li><strong>Payment Processors:</strong> We share financial data with secure, PCI-compliant payment processing partners to facilitate transactions.</li>
              <li><strong>Service Providers:</strong> We engage third-party service providers (e.g., hosting, analytics, email delivery) who process data on our behalf under strict contractual obligations of confidentiality.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information where required by law, regulation, legal process, or governmental request.</li>
            </ul>
            <p>
              We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
            </p>
          </section>

          {/* 6. International Data Transfers */}
          <section>
            <h2>6. International data transfers</h2>
            <p>
              As Medic Connect operates in both Nigeria and the United Kingdom, your personal data may be transferred between these jurisdictions. When we transfer personal data internationally, we ensure that appropriate safeguards are in place to protect your information in accordance with the NDPA and UK GDPR, including the use of standard contractual clauses, adequacy decisions, and other legally recognised transfer mechanisms.
            </p>
          </section>

          {/* 7. Data Retention */}
          <section>
            <h2>7. Data retention</h2>
            <p>
              We retain personal data only for as long as necessary to fulfil the purposes for which it was collected, unless a longer retention period is required or permitted by law. Our general retention periods are:
            </p>
            <ul>
              <li><strong>Client healthcare records:</strong> Retained for a minimum of 8 years from the date of last service, or longer as required by applicable healthcare regulations.</li>
              <li><strong>Professional credentials and employment data:</strong> Retained for the duration of the professional's active status in our network, plus 6 years thereafter.</li>
              <li><strong>Financial and transaction records:</strong> Retained for 7 years in accordance with tax and accounting regulations.</li>
              <li><strong>Marketing and newsletter data:</strong> Retained until you withdraw your consent or unsubscribe.</li>
              <li><strong>Website analytics data:</strong> Retained for up to 26 months.</li>
              <li><strong>Contact form submissions and enquiries:</strong> Retained for 3 years.</li>
            </ul>
          </section>

          {/* 8. Data Security */}
          <section>
            <h2>8. Data security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. These measures include, but are not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Role-based access controls limiting data access to authorised personnel</li>
              <li>Regular security assessments and vulnerability testing</li>
              <li>Staff training on data protection and confidentiality obligations</li>
              <li>Secure data backup and disaster recovery procedures</li>
              <li>Incident response procedures for data breaches</li>
            </ul>
            <p>
              While we strive to protect your personal information, no method of electronic transmission or storage is completely secure. We cannot guarantee absolute security but are committed to maintaining industry-standard protections.
            </p>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2>9. Cookies and tracking technologies</h2>
            <p>
              Our website uses cookies and similar tracking technologies to enhance your browsing experience and to collect usage data. The types of cookies we use include:
            </p>
            <ul>
              <li><strong>Strictly Necessary Cookies:</strong> Required for the website to function properly, including authentication and security cookies.</li>
              <li><strong>Analytical/Performance Cookies:</strong> Help us understand how visitors interact with our website by collecting information about pages visited and errors encountered.</li>
              <li><strong>Functionality Cookies:</strong> Enable enhanced features and personalisation, such as remembering your preferences.</li>
            </ul>
            <p>
              You can manage your cookie preferences through your browser settings. Please note that disabling certain cookies may affect the functionality of our website.
            </p>
          </section>

          {/* 10. Your Rights Under NDPA */}
          <section>
            <h2>10. Your rights under the Nigeria Data Protection Act 2023</h2>
            <p>
              If you are located in Nigeria, you have the following rights under the NDPA:
            </p>
            <ul>
              <li><strong>Right of Access:</strong> You have the right to request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Rectification:</strong> You have the right to request correction of inaccurate or incomplete personal data.</li>
              <li><strong>Right to Erasure:</strong> You have the right to request deletion of your personal data, subject to legal and regulatory retention requirements.</li>
              <li><strong>Right to Restriction of Processing:</strong> You have the right to request that we restrict the processing of your personal data in certain circumstances.</li>
              <li><strong>Right to Data Portability:</strong> You have the right to receive your personal data in a structured, commonly used, and machine-readable format.</li>
              <li><strong>Right to Object:</strong> You have the right to object to the processing of your personal data for direct marketing or where we rely on legitimate interests.</li>
              <li><strong>Right to Withdraw Consent:</strong> Where processing is based on consent, you may withdraw your consent at any time without affecting the lawfulness of processing carried out prior to withdrawal.</li>
            </ul>
          </section>

          {/* 11. Your Rights Under UK GDPR */}
          <section>
            <h2>11. Your rights under UK GDPR</h2>
            <p>
              If you are located in the United Kingdom, you have the following rights under the UK GDPR:
            </p>
            <ul>
              <li>Right of access to your personal data</li>
              <li>Right to rectification of inaccurate personal data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restriction of processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Rights relating to automated decision-making and profiling</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us using the details provided in Section 14 below. We will respond to your request within 30 days (or as otherwise required by applicable law). We may request verification of your identity before processing your request.
            </p>
          </section>

          {/* 12. Children's Privacy */}
          <section>
            <h2>12. Children's privacy</h2>
            <p>
              Our website and Services are not directed at children under the age of 18. We do not knowingly collect personal information from children under 18 without parental or guardian consent. Where we provide paediatric or nanny/childcare services, all personal data relating to minors is collected from and managed by their parents or legal guardians. If you believe we have inadvertently collected personal data from a child without appropriate consent, please contact us immediately and we will take steps to delete such information.
            </p>
          </section>

          {/* 13. Changes to This Policy */}
          <section>
            <h2>13. Changes to this privacy policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by posting the updated policy on this page and updating the "Last updated" date above. We encourage you to review this Privacy Policy periodically. Your continued use of our Services after any modifications constitutes your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* 14. Contact Us */}
          <section>
            <h2>14. Contact us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data processing practices, please contact us at:
            </p>
            <div className="mt-4">
              <p><strong>Medic Connect</strong></p>
              <p>145 Igbosere Road, Lagos Island, Lagos, Nigeria</p>
              <p>Email: hello@medicconnect.co</p>
              <p>Phone: +234 812 698 8237</p>
            </div>
            <p>
              If you are not satisfied with our response to your complaint, you have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC) or the UK Information Commissioner's Office (ICO), as applicable.
            </p>
          </section>
        </div>
      </KitMain>

      <Footer />
    </div>
  );
};

export default Privacy;
