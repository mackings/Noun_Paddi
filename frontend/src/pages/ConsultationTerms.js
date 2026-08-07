import React from 'react';
import SEO from '../components/SEO';
import ShellHeader from '../shell/ShellHeader';
import { Card, CardContent } from '../components/ui/card';

const SECTIONS = [
  {
    title: 'What the consultation covers',
    items: [
      'Project assessment, structure review, and originality guidance.',
      'Clear explanation of risks, weak sections, and improvement steps.',
      'Support for all departments: business, agriculture, health tech, coding, and more.',
    ],
  },
  {
    title: 'Session details',
    items: [
      'Duration: up to 2 hours.',
      'Available slots: 9:00 AM, 12:00 PM, and 3:00 PM.',
      'Fee: N2,000 (consultation only).',
    ],
  },
  {
    title: 'After payment',
    items: [
      'Complete the consultation request form with your preferred date and time.',
      'We will contact you via email or phone to confirm.',
    ],
  },
];

const ConsultationTerms = () => {
  return (
    <div className="np-shell">
      <SEO
        title="Consultation Terms - NounPaddi"
        description="Understand the scope of the project consultation service before booking."
        url="/consultation-terms"
      />
      <ShellHeader title="Consultation Terms" />

      <div className="tw:space-y-4 tw:p-4">
        <Card>
          <CardContent className="tw:space-y-5 tw:p-5">
            <div>
              <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">
                Project Consultation
              </p>
              <h1 className="tw:font-heading tw:mt-1 tw:text-xl tw:font-bold tw:tracking-tight">
                Consultation Terms &amp; Scope
              </h1>
              <p className="tw:mt-2 tw:text-sm tw:leading-relaxed tw:text-slate-600 tw:dark:text-slate-300">
                This consultation is focused on assessing your project, identifying potential issues, and guiding you
                on how to strengthen your work. It is not a full rewrite service. If you later request correction
                support, pricing will be discussed privately.
              </p>
            </div>

            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="tw:font-heading tw:text-sm tw:font-bold">{section.title}</h2>
                <ul className="tw:mt-2 tw:list-disc tw:space-y-1.5 tw:pl-5 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            <p className="tw:border-t tw:border-slate-200/70 tw:pt-4 tw:text-xs tw:text-slate-500 tw:dark:border-slate-800 tw:dark:text-slate-400">
              By submitting a consultation request, you agree that this service focuses on assessment and guidance
              only.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsultationTerms;
