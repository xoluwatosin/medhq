import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import KitPageHero from "@/components/kit/KitPageHero";
import { KitMain } from "@/components/kit/KitLayout";
import KitLegal from "@/components/kit/KitLegal";
import { art } from "@/components/mc/art";

const Terms = () => {
  return (
    <div className="min-h-dvh bg-background">
      <SEO title="Terms of Service | Medic Connect" description="Terms governing the use of Medic Connect services and website." path="/terms" />
      <MedicHeader />

      <KitPageHero eyebrow="Legal" title="Terms of service" accent={[2]} lead="Last updated 17 February 2026." art={art.objSignedContract} artClassName="bottom-8 h-[110px] md:mb-16 md:h-[190px] lg:h-[220px]" />

      <KitMain>
        <KitLegal note={<>Questions about these terms? Email <a className="font-extrabold text-brand underline" href="mailto:hello@medicconnect.co">hello@medicconnect.co</a>.</>}>

          {/* 1. Agreement to Terms */}
          <section>
            <h2>1. Agreement to terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you", "your") and Medic Connect ("Company", "we", "us", "our"), a company registered in England and Wales (Company Number 15986218) and in Nigeria (RC 8026476), with its principal office at 145 Igbosere Road, Lagos Island, Lagos, Nigeria.
            </p>
            <p>
              By accessing or using the Medic Connect website (medicconnect.co), the Perspective blog, or any of our healthcare staffing, home care, hospital support, clinical research, or related services (collectively, the "Services"), you agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use our Services.
            </p>
          </section>

          {/* 2. Definitions */}
          <section>
            <h2>2. Definitions</h2>
            <p>
              In these Terms, the following definitions apply:
            </p>
            <ul>
              <li><strong>"Services"</strong> means all healthcare staffing, home care, clinical home care, antenatal care, postnatal care, paediatric care, eldercare, nanny and childcare, hospital staffing, hospital support, clinical research, and related services offered by Medic Connect, as well as the Medic Connect website and the Perspective blog.</li>
              <li><strong>"User"</strong> means any individual or entity that accesses or uses the Services, whether as a client, healthcare professional, website visitor, or blog reader.</li>
              <li><strong>"Healthcare Professional"</strong> means any nurse, caregiver, clinician, allied health professional, or other qualified individual who provides services through the Medic Connect network.</li>
              <li><strong>"Client"</strong> means any individual, family, hospital, healthcare facility, or organisation that engages Medic Connect to provide healthcare staffing or care services.</li>
              <li><strong>"Platform"</strong> means the Medic Connect website, applications, and digital infrastructure through which Services are accessed and delivered.</li>
            </ul>
          </section>

          {/* 3. Eligibility */}
          <section>
            <h2>3. Eligibility</h2>
            <p>
              To use our Services, you must be at least 18 years of age and possess the legal capacity to enter into a binding agreement. If you are accessing our Services on behalf of an organisation, you represent and warrant that you have the authority to bind that organisation to these Terms. Healthcare Professionals must additionally hold valid professional licences and certifications as required by applicable law in the jurisdiction where they provide services.
            </p>
          </section>

          {/* 4. Description of Services */}
          <section>
            <h2>4. Description of services</h2>
            <p>
              Medic Connect provides healthcare staffing and home care solutions, including but not limited to: clinical home care (skilled nursing, wound care, IV therapy, post-operative care), antenatal and postnatal care, paediatric care, eldercare and companion care, nanny and childcare services, hospital staffing (temporary, permanent, and locum placements), hospital support services (housekeeping, laundry, security, event medical cover), and clinical research staffing and coordination.
            </p>
            <p>
              Medic Connect acts as an intermediary connecting Clients with qualified Healthcare Professionals. While we conduct thorough vetting and verification of Healthcare Professionals in our network, the clinical care and services provided are delivered by the individual Healthcare Professionals, who are responsible for the standard of care they provide in accordance with their professional obligations and applicable laws.
            </p>
          </section>

          {/* 5. User Obligations */}
          <section>
            <h2>5. User obligations</h2>
            <p>
              As a User of our Services, you agree to:
            </p>
            <ul>
              <li>Provide accurate, current, and complete information when creating an account, submitting applications, or making enquiries</li>
              <li>Maintain the confidentiality of your account credentials and promptly notify us of any unauthorised access</li>
              <li>Use the Services only for lawful purposes and in compliance with all applicable laws and regulations</li>
              <li>Not misrepresent your identity, qualifications, or affiliation</li>
              <li>Not attempt to interfere with, disrupt, or compromise the security or integrity of our Platform</li>
              <li>Not use the Services to transmit any harmful, offensive, or unlawful content</li>
              <li>Not circumvent, disable, or otherwise interfere with any security features of the Platform</li>
            </ul>
          </section>

          {/* 6. Healthcare Professional Terms */}
          <section>
            <h2>6. Healthcare professional terms</h2>
            <p>
              Healthcare Professionals who join the Medic Connect network additionally agree to:
            </p>
            <ul>
              <li>Maintain valid and current professional licences, certifications, and registrations as required by applicable law</li>
              <li>Provide services in accordance with accepted professional standards, codes of ethics, and best practices</li>
              <li>Maintain strict confidentiality of all patient and client information in accordance with applicable data protection and healthcare privacy laws</li>
              <li>Promptly report any adverse events, incidents, or concerns relating to patient safety to Medic Connect</li>
              <li>Not solicit Clients directly for private engagements outside the Medic Connect network during the term of engagement and for 12 months thereafter</li>
              <li>Cooperate with any investigations, audits, or reviews conducted by Medic Connect or regulatory authorities</li>
              <li>Maintain adequate professional indemnity insurance where required by law or by Medic Connect</li>
            </ul>
          </section>

          {/* 7. Client Terms */}
          <section>
            <h2>7. Client terms</h2>
            <p>
              Clients engaging Medic Connect for healthcare staffing or care services additionally agree to:
            </p>
            <ul>
              <li>Provide accurate and complete information regarding care requirements, medical history, and any special needs or risks</li>
              <li>Ensure a safe working environment for Healthcare Professionals, free from hazards, harassment, and discrimination</li>
              <li>Adhere to the agreed care plan and cooperate with Healthcare Professionals in the delivery of services</li>
              <li>Make timely payment for all Services rendered in accordance with the agreed fee schedule</li>
              <li>Not request Healthcare Professionals to perform tasks outside their scope of practice or professional competence</li>
              <li>Notify Medic Connect promptly of any concerns regarding the quality of care or conduct of Healthcare Professionals</li>
              <li>Not directly engage or solicit Medic Connect Healthcare Professionals outside the Medic Connect network during the term of service and for 12 months thereafter without prior written consent</li>
            </ul>
          </section>

          {/* 8. Fees and Payment */}
          <section>
            <h2>8. Fees and payment</h2>
            <p>
              Fees for our Services are as quoted or agreed upon in writing between Medic Connect and the Client. All fees are exclusive of applicable taxes unless stated otherwise. Payment terms are as specified in the applicable service agreement or invoice. Late payments may attract interest at the rate of 2% per month or the maximum rate permitted by law, whichever is lower. Medic Connect reserves the right to suspend or terminate Services in the event of non-payment.
            </p>
          </section>

          {/* 9. Intellectual Property */}
          <section>
            <h2>9. Intellectual property</h2>
            <p>
              All content, materials, trademarks, logos, designs, text, graphics, images, software, and other intellectual property displayed on or made available through the Platform are the property of Medic Connect or its licensors and are protected by applicable copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works from, publicly display, or exploit any of our intellectual property without our prior written consent.
            </p>
            <p>
              Content published on the Perspective blog is the property of Medic Connect or its contributing authors and may not be republished, redistributed, or repurposed without express written permission.
            </p>
          </section>

          {/* 10. Disclaimer of Warranties */}
          <section>
            <h2>10. Disclaimer of warranties</h2>
            <p>
              THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, MEDIC CONNECT DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              While Medic Connect undertakes thorough vetting and verification of Healthcare Professionals in its network, we do not warrant or guarantee the outcomes of any healthcare services provided. Healthcare Professionals exercise independent professional judgement in the delivery of clinical care, and Medic Connect does not practise medicine or provide medical advice.
            </p>
          </section>

          {/* 11. Limitation of Liability */}
          <section>
            <h2>11. Limitation of liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MEDIC CONNECT, ITS DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICES, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL THEORY.
            </p>
            <p>
              IN NO EVENT SHALL MEDIC CONNECT'S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES EXCEED THE TOTAL AMOUNT PAID BY YOU TO MEDIC CONNECT IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
            <p>
              Nothing in these Terms shall exclude or limit liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be excluded or limited under applicable law.
            </p>
          </section>

          {/* 12. Indemnification */}
          <section>
            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Medic Connect, its directors, officers, employees, agents, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or in connection with: (a) your use of or access to the Services; (b) your violation of these Terms; (c) your violation of any third-party rights, including intellectual property or privacy rights; or (d) any content you submit, post, or transmit through the Services.
            </p>
          </section>

          {/* 13. Termination */}
          <section>
            <h2>13. Termination</h2>
            <p>
              Medic Connect reserves the right to suspend or terminate your access to the Services, in whole or in part, at any time and for any reason, including but not limited to a breach of these Terms, without prior notice or liability. Upon termination, your right to use the Services will immediately cease. Any provisions of these Terms that by their nature should survive termination shall continue in full force and effect, including but not limited to intellectual property, limitation of liability, indemnification, and governing law provisions.
            </p>
          </section>

          {/* 14. Governing Law and Dispute Resolution */}
          <section>
            <h2>14. Governing law and dispute resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law provisions.
            </p>
            <p>
              Any dispute, controversy, or claim arising out of or in connection with these Terms or the Services shall first be resolved through good-faith negotiation between the parties. If the dispute cannot be resolved through negotiation within thirty (30) days, either party may submit the dispute to mediation administered by the Lagos Court of Arbitration. If mediation is unsuccessful, either party may pursue resolution in the courts of competent jurisdiction in Lagos, Nigeria.
            </p>
            <p>
              For Users located in the United Kingdom, nothing in this clause shall prevent you from bringing proceedings in the courts of England and Wales where you have a statutory right to do so.
            </p>
          </section>

          {/* 15. Severability */}
          <section>
            <h2>15. Severability</h2>
            <p>
              If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such invalidity, illegality, or unenforceability shall not affect the remaining provisions of these Terms, which shall continue in full force and effect. The invalid or unenforceable provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the original intent of the parties.
            </p>
          </section>

          {/* 16. Entire Agreement */}
          <section>
            <h2>16. Entire agreement</h2>
            <p>
              These Terms, together with our Privacy Policy and any applicable service agreements, constitute the entire agreement between you and Medic Connect with respect to the subject matter hereof and supersede all prior or contemporaneous communications, representations, or agreements, whether oral or written, relating to the same subject matter. No waiver of any provision of these Terms shall be deemed a further or continuing waiver of such provision or any other provision.
            </p>
          </section>

          {/* 17. Modifications */}
          <section>
            <h2>17. Modifications</h2>
            <p>
              Medic Connect reserves the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page and updating the "Last updated" date above. Your continued use of the Services after any modifications constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          {/* 18. Contact Information */}
          <section>
            <h2>18. Contact information</h2>
            <p>
              If you have any questions, concerns, or requests regarding these Terms of Service, please contact us at:
            </p>
            <div className="mt-4">
              <p><strong>Medic Connect</strong></p>
              <p>145 Igbosere Road, Lagos Island, Lagos, Nigeria</p>
              <p>Email: hello@medicconnect.co</p>
              <p>Phone: +234 812 698 8237</p>
            </div>
          </section>
        </KitLegal>
      </KitMain>

      <Footer />
    </div>
  );
};

export default Terms;
