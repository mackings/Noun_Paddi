import React from 'react';
import { FiAlertTriangle, FiShield, FiBookOpen, FiCheckCircle } from 'react-icons/fi';
import SEO from '../components/SEO';
import './Disclaimer.css';

const Disclaimer = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'NounPaddi Disclaimer & Responsible Use Policy',
    description: 'Responsible use policy and disclaimer for NounPaddi, the NOUN student learning community.',
    url: 'https://nounpaddi.com/disclaimer',
  };

  return (
    <div className="disclaimer-page">
      <SEO
        title="NounPaddi Disclaimer & Responsible Use Policy"
        description="Read the NounPaddi disclaimer and responsible use policy for NOUN students using summaries, practice questions, and study tools."
        url="/disclaimer"
        keywords="NounPaddi disclaimer, responsible use policy, NOUN study platform policy"
        structuredData={structuredData}
      />
      <div className="container">
        <div className="disclaimer-hero">
          <div className="disclaimer-icon-wrap">
            <FiAlertTriangle size={36} />
          </div>
          <p className="disclaimer-kicker">Important Notice</p>
          <h1>NounPaddi Disclaimer & Responsible Use Policy</h1>
          <p>
            NounPaddi is an educational support platform powered by machine learning and automated content generation.
            It is designed to help students revise faster, discover topics, and practice with learning materials in a structured way.
            The platform is not an official NOUN examination authority, and no feature on this website should be interpreted
            as a source of guaranteed NOUN exact questions.
          </p>
        </div>

        <section className="disclaimer-section">
          <h2><FiBookOpen size={20} /> What This Platform Is</h2>
          <p>
            NounPaddi provides learning tools such as summaries, practice questions, and study guidance generated from
            user-provided materials and algorithmic analysis. These resources are intended for study assistance only.
            They are meant to improve understanding, revision quality, and exam preparedness through legitimate academic effort.
          </p>
          <p>
            Any similarity between practice content and past or future examination questions can happen naturally in academic
            subjects, but this does not mean the platform has access to or distributes protected NOUN examination materials.
            Students should treat all generated content as revision support, not as leaked papers, not as official exam scripts,
            and not as a substitute for proper learning.
          </p>
        </section>

        <section className="disclaimer-section">
          <h2><FiShield size={20} /> What This Platform Is Not</h2>
          <ul>
            <li>It is not affiliated with exam malpractice networks.</li>
            <li>It does not promote cheating, fraud, impersonation, or academic dishonesty.</li>
            <li>It is not a source of NOUN exact questions or leaked examination papers.</li>
            <li>It does not guarantee scores, grades, or exam outcomes.</li>
            <li>It should not be used to misrepresent effort, forge submissions, or bypass institutional rules.</li>
          </ul>
          <p>
            Users are fully responsible for how they use the platform. If any user attempts to use NounPaddi for unethical,
            illegal, or fraudulent purposes, that use is unauthorized and against this platform policy.
          </p>
        </section>

        <section className="disclaimer-section">
          <h2><FiCheckCircle size={20} /> Responsible Use Expectations</h2>
          <p>
            By using this platform, you agree to use it as a study aid in a lawful and ethical manner. You should verify
            generated content, cross-check with your official course materials, and follow all NOUN and departmental academic
            integrity policies. Generated answers and summaries may contain inaccuracies, omissions, or outdated interpretations,
            so human judgment and independent reading are always required.
          </p>
          <p>
            NounPaddi encourages genuine learning: understand concepts, practice honestly, cite sources where needed,
            and submit only work that reflects your own effort. The platform should support your preparation process,
            not replace discipline, not replace attendance, and not replace official guidance from your lecturers or faculty.
          </p>
        </section>

        <section className="disclaimer-section">
          <h2><FiAlertTriangle size={20} /> Limitation of Liability</h2>
          <p>
            NounPaddi and its operators are not liable for decisions made solely from generated outputs,
            including academic penalties, disciplinary action, loss of marks, or related consequences.
            The user bears responsibility for reviewing all material before relying on it.
          </p>
          <p>
            If you need official information about NOUN assessments, examination format, grading, or approved curriculum,
            consult official NOUN channels and your faculty resources directly.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Disclaimer;
