import { CONTACT_EMAIL, LegalPage } from '@/features/legal/LegalPage';

// Plain-language privacy policy describing what the app actually stores.
// Have it reviewed by a legal advisor before a public launch.
export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`SevaSetu helps volunteers find and join seva (selfless service) and helps organizations coordinate it. This policy explains what information SevaSetu keeps, why, who can see it, and the choices you have. Questions: ${CONTACT_EMAIL}.`}
      sections={[
        {
          heading: 'Who runs SevaSetu',
          paragraphs: [`SevaSetu is operated by Harshil Vanani for volunteer seva organized with The Art of Living community. Contact us at ${CONTACT_EMAIL}.`],
        },
        {
          heading: 'What we collect',
          bullets: [
            'Account: your name, email address and how you sign in (email and password, or Google). If you use Google, Google shares your name, email and profile photo with us. Passwords are stored only in encrypted form by our authentication provider.',
            'Profile details you choose to add: city or area, your approximate location if you allow it (to show distances), how far you will travel, interests, skills, weekly availability, how you like to serve, hours per week and language.',
            'Your seva activity: the seva you join, the quantity you take on, the progress you report and notes you write, organizers’ reviews of your reports (including any adjustment and its reason), invitations, and in-app notifications.',
            'If you organize: your organization’s name, city and description, and the events and tasks you publish.',
            'If you allow notifications on a phone: a push notification token for that device.',
          ],
        },
        {
          heading: 'How we use it',
          bullets: [
            'To show you seva that fits your interests, location and availability.',
            'To let you join seva, report progress, and receive confirmations, reminders and updates.',
            'To let organizers coordinate the seva you take part in and verify the work reported.',
            'To keep SevaSetu safe: reviewing new organizations and stopping misuse.',
          ],
          paragraphs: ['We do not sell your information, show ads, or use advertising or analytics trackers.'],
        },
        {
          heading: 'Who can see your information',
          bullets: [
            'Organizers of a seva you join or are invited to can see your name, email address and profile details, and your joins, progress reports and notes for their seva.',
            'Other volunteers do not see your contact details.',
            'SevaSetu administrators can see account information, organizations and activity to review organizations and keep the platform safe. Their actions are recorded in an audit log.',
            'Anyone, even without an account, can see public seva listings and the name of the organization running them.',
          ],
        },
        {
          heading: 'Services we use',
          bullets: [
            'Supabase stores the app’s data and handles sign-in. Data is held in the United States (Oregon).',
            'Hostinger hosts the SevaSetu website.',
            'Google provides “Continue with Google” sign-in, if you choose it.',
            'Expo delivers push notifications to phones that allow them.',
          ],
          paragraphs: ['These providers process information only to run their part of the service.'],
        },
        {
          heading: 'How long we keep it',
          paragraphs: [
            'We keep your information while your account exists. You can delete your account at any time in Profile → Delete account. This permanently removes your profile, availability, seva history, progress reports and notifications. If you are the only owner of an organization, add another owner or delete the organization first.',
            'If an administrator acted on your account or organization, the audit log keeps a short record of that action, with your name, for safety reasons.',
          ],
        },
        {
          heading: 'Your choices',
          bullets: [
            'Edit your profile, interests and availability at any time in the app.',
            'Location is optional: you can type a city instead, or nothing at all.',
            'Turn push notifications on or off in your phone’s settings.',
            `Ask for a copy of your information, or for corrections, by writing to ${CONTACT_EMAIL}.`,
          ],
        },
        {
          heading: 'Children',
          paragraphs: ['SevaSetu is not meant for children under 16 without the involvement of a parent or guardian, who should create and manage the account.'],
        },
        {
          heading: 'Changes to this policy',
          paragraphs: ['If we change this policy, we will update the date at the top. Significant changes will be announced in the app.'],
        },
      ]}
    />
  );
}
