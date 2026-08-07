import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Clock, Mail, Phone, Send } from 'lucide-react';
import SEO from '../components/SEO';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import ShellHeader from '../shell/ShellHeader';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const STEPS = [
  { title: 'Review Consultation', description: 'Assessment, feedback, and guidance across all departments.' },
  { title: 'Make Payment', description: 'Pay N2,000 to reserve a 2-hour session.' },
  { title: 'Pick Date & Time', description: 'Choose 9am, 12pm, or 3pm and submit.' },
];

const ProjectConsultation = () => {
  const location = useLocation();
  const minConsultDate = new Date().toISOString().split('T')[0];
  const [consultationForm, setConsultationForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: '',
    projectTitle: '',
    issueSummary: '',
    preferredDate: '',
    preferredTime: '09:00',
    paymentReference: '',
    acceptedTerms: false,
  });
  const [consultationStatus, setConsultationStatus] = useState({ loading: false, error: '', success: '' });
  const [paymentStatus, setPaymentStatus] = useState({ loading: false, error: '' });

  useEffect(() => {
    trackFeatureVisit('project_consultation');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldVerify = params.get('consultation') === '1';
    const txRef = params.get('tx_ref');

    if (!shouldVerify || !txRef) {
      return;
    }

    const verifyPaymentAndSubmit = async () => {
      try {
        setPaymentStatus({ loading: true, error: '' });
        const verifyRes = await api.get(`/projects/consultations/verify?tx_ref=${encodeURIComponent(txRef)}`);
        const draft = JSON.parse(localStorage.getItem('consultationFormDraft') || '{}');
        if (!draft || !draft.fullName) {
          setPaymentStatus({ loading: false, error: 'Payment verified, but consultation form was not found.' });
          return;
        }

        await api.post('/projects/consultations', {
          ...draft,
          hasPaid: true,
          paymentReference: verifyRes.data?.data?.transactionId || txRef,
        });

        localStorage.removeItem('consultationFormDraft');
        setConsultationStatus({
          loading: false,
          error: '',
          success: 'Consultation request submitted. We will contact you shortly.',
        });
        setPaymentStatus({ loading: false, error: '' });
        window.history.replaceState({}, '', '/projects/consultation');
      } catch (err) {
        setPaymentStatus({
          loading: false,
          error: err.response?.data?.message || 'Payment verification failed.',
        });
      }
    };

    verifyPaymentAndSubmit();
  }, [location.search]);

  const handleConsultationChange = (field, value) => {
    setConsultationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePayAndSubmit = async (event) => {
    event.preventDefault();
    setPaymentStatus({ loading: true, error: '' });
    setConsultationStatus({ loading: false, error: '', success: '' });

    const requiredFields = [
      consultationForm.fullName,
      consultationForm.email,
      consultationForm.phone,
      consultationForm.department,
      consultationForm.projectTitle,
      consultationForm.issueSummary,
      consultationForm.preferredDate,
      consultationForm.preferredTime,
    ];

    if (requiredFields.some((value) => !String(value || '').trim())) {
      setPaymentStatus({ loading: false, error: 'Please complete all consultation fields before payment.' });
      return;
    }

    if (!consultationForm.acceptedTerms) {
      setPaymentStatus({ loading: false, error: 'Please accept the consultation terms.' });
      return;
    }

    try {
      localStorage.setItem('consultationFormDraft', JSON.stringify(consultationForm));
      const response = await api.post('/projects/consultations/initiate-payment', {
        email: consultationForm.email,
        fullName: consultationForm.fullName,
        phone: consultationForm.phone,
      });

      const paymentLink = response.data?.data?.link;
      if (!paymentLink) {
        throw new Error('Payment link was not generated.');
      }
      window.location.href = paymentLink;
    } catch (err) {
      setPaymentStatus({
        loading: false,
        error: err.response?.data?.message || err.message || 'Unable to start payment.',
      });
    }
  };

  const inputClass = 'tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3.5 tw:text-sm tw:text-slate-900 tw:outline-none tw:transition-colors tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

  return (
    <div className="np-shell">
      <SEO
        title="Project Consultation - NounPaddi"
        description="Book a paid consultation to assess your project and identify potential issues."
        url="/projects/consultation"
      />
      <ShellHeader title="Book a Consultation" />

      <div className="tw:space-y-4 tw:p-4">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Projects Hub</p>
          <h1 className="tw:font-heading tw:mt-1 tw:text-xl tw:font-bold tw:tracking-tight">Book a Project Consultation</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">Two-hour session to assess your project and guide improvements.</p>
        </div>

        <Card className="tw:space-y-3 tw:p-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="tw:flex tw:items-start tw:gap-3">
              <span
                className={cn(
                  'tw:flex tw:h-7 tw:w-7 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-bold',
                  index === 0
                    ? 'tw:bg-brand-600 tw:text-white'
                    : 'tw:bg-slate-100 tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400',
                )}
              >
                {index + 1}
              </span>
              <div>
                <h4 className="tw:text-sm tw:font-semibold">{step.title}</h4>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </Card>

        <Card className="tw:space-y-3 tw:p-4">
          <h2 className="tw:font-heading tw:text-sm tw:font-bold">What you get</h2>
          <ul className="tw:list-disc tw:space-y-1 tw:pl-4 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
            <li>Project assessment and risk check.</li>
            <li>Guidance on structure, originality, and improvement steps.</li>
            <li>Coverage for all departments: business, agric, health tech, coding, and more.</li>
          </ul>
          <div className="tw:grid tw:grid-cols-3 tw:gap-2 tw:border-t tw:border-slate-100 tw:pt-3 tw:dark:border-slate-800">
            <div>
              <p className="tw:text-[10px] tw:text-slate-400">Fee</p>
              <strong className="tw:text-sm">N2,000</strong>
            </div>
            <div>
              <p className="tw:text-[10px] tw:text-slate-400">Duration</p>
              <strong className="tw:text-sm">Up to 2 hrs</strong>
            </div>
            <div>
              <p className="tw:text-[10px] tw:text-slate-400">Time slots</p>
              <strong className="tw:text-sm">9, 12, 3</strong>
            </div>
          </div>
          <Link to="/consultation-terms" className="tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
            View consultation terms
          </Link>
        </Card>

        <Card>
          <CardContent className="tw:space-y-4 tw:p-5">
            <div>
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Consultation form</h2>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Tell us about your project and pick a time slot.</p>
            </div>
            <form onSubmit={handlePayAndSubmit} className="tw:space-y-4">
              <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Full name</span>
                  <Input
                    type="text"
                    value={consultationForm.fullName}
                    onChange={(event) => handleConsultationChange('fullName', event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </label>
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Email</span>
                  <Input
                    type="email"
                    value={consultationForm.email}
                    onChange={(event) => handleConsultationChange('email', event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </label>
              </div>

              <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Phone className="tw:h-3.5 tw:w-3.5" /> Phone number</span>
                  <Input
                    type="tel"
                    value={consultationForm.phone}
                    onChange={(event) => handleConsultationChange('phone', event.target.value)}
                    placeholder="0800 000 0000"
                    required
                  />
                </label>
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Mail className="tw:h-3.5 tw:w-3.5" /> Department</span>
                  <Input
                    type="text"
                    value={consultationForm.department}
                    onChange={(event) => handleConsultationChange('department', event.target.value)}
                    placeholder="e.g. Business, Agric, Health Tech, Coding"
                    required
                  />
                </label>
              </div>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Project title</span>
                <Input
                  type="text"
                  value={consultationForm.projectTitle}
                  onChange={(event) => handleConsultationChange('projectTitle', event.target.value)}
                  placeholder="Project title"
                  required
                />
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Project issues or goals</span>
                <textarea
                  rows={4}
                  value={consultationForm.issueSummary}
                  onChange={(event) => handleConsultationChange('issueSummary', event.target.value)}
                  placeholder="Describe the help you need (structure, originality, research scope, etc.)"
                  required
                  className="tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
                />
              </label>

              <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Calendar className="tw:h-3.5 tw:w-3.5" /> Preferred date</span>
                  <Input
                    type="date"
                    value={consultationForm.preferredDate}
                    onChange={(event) => handleConsultationChange('preferredDate', event.target.value)}
                    min={minConsultDate}
                    required
                  />
                </label>
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Clock className="tw:h-3.5 tw:w-3.5" /> Time slot</span>
                  <select
                    value={consultationForm.preferredTime}
                    onChange={(event) => handleConsultationChange('preferredTime', event.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="09:00">9:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="15:00">3:00 PM</option>
                  </select>
                </label>
              </div>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Payment reference (optional)</span>
                <Input
                  type="text"
                  value={consultationForm.paymentReference}
                  onChange={(event) => handleConsultationChange('paymentReference', event.target.value)}
                  placeholder="Flutterwave reference"
                />
              </label>

              <label className="tw:flex tw:items-center tw:gap-2 tw:text-sm">
                <input
                  type="checkbox"
                  id="consult-terms"
                  checked={consultationForm.acceptedTerms}
                  onChange={(event) => handleConsultationChange('acceptedTerms', event.target.checked)}
                  required
                  className="tw:h-4 tw:w-4 tw:accent-brand-600"
                />
                I agree to the consultation terms.
              </label>

              {paymentStatus.error && (
                <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">{paymentStatus.error}</div>
              )}
              {paymentStatus.loading && (
                <div className="tw:rounded-xl tw:bg-blue-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-blue-700 tw:dark:bg-blue-500/15 tw:dark:text-blue-300">Verifying payment. Please wait...</div>
              )}
              {consultationStatus.error && (
                <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">{consultationStatus.error}</div>
              )}
              {consultationStatus.success && (
                <div className="tw:rounded-xl tw:bg-emerald-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">{consultationStatus.success}</div>
              )}

              <Button type="submit" disabled={paymentStatus.loading} className="tw:w-full">
                {paymentStatus.loading ? 'Redirecting to payment...' : <><Send className="tw:h-4 tw:w-4" /> Pay &amp; Submit Consultation</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectConsultation;
