import { CONTACT_EMAIL, LegalPage } from '@/features/legal/LegalPage';

// Plain-language terms of use. Have them reviewed by a legal advisor before a public launch.
export default function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These terms apply when you use SevaSetu, on the web or in the app. By creating an account or using SevaSetu you agree to them."
      sections={[
        {
          heading: 'What SevaSetu is',
          paragraphs: [
            'SevaSetu connects people who want to volunteer with organizations that run seva (selfless service). Organizations publish events and tasks; volunteers join them and report the work they complete.',
            'SevaSetu is a coordination tool. The seva itself is run by the organization that publishes it.',
          ],
        },
        {
          heading: 'Your account',
          bullets: [
            'Give accurate information and keep your sign-in details private.',
            'You are responsible for activity on your account.',
            'Anyone under 16 should use SevaSetu with a parent or guardian.',
          ],
        },
        {
          heading: 'Volunteering',
          bullets: [
            'Volunteering is voluntary and unpaid. Joining a seva does not create employment or any other contract with SevaSetu.',
            'Only join what you can complete, and update or leave a seva in My Seva if your plans change.',
            'Report progress honestly. Organizers may adjust or decline reports, with a reason.',
            'Follow the organizer’s instructions and any safety guidance at the seva.',
          ],
        },
        {
          heading: 'Organizers',
          bullets: [
            'New organizations are reviewed before they can publish. Approval can be withdrawn.',
            'Describe each seva accurately, including time, place, and what volunteers will do.',
            'You are responsible for running your seva safely and lawfully, including any checks or supervision your activities require.',
            'Use volunteers’ information only to coordinate your seva on SevaSetu, and never share it for other purposes.',
          ],
        },
        {
          heading: 'Donations',
          bullets: [
            'Donations go directly to the organization running the campaign, through its own Stripe account. SevaSetu does not hold or keep any part of your donation.',
            'Stripe emails you a payment receipt. Official tax receipts, refunds and questions about how funds are used are handled by the organization.',
            'Monthly donations continue until you cancel them using the link in Stripe’s emails, or by contacting the organization.',
            'Organizers must describe campaigns honestly and use funds for the stated purpose.',
          ],
        },
        {
          heading: 'What’s not allowed',
          bullets: [
            'Misleading or fake events, organizations or reports.',
            'Harassment, discrimination or hateful content.',
            'Collecting volunteers’ information for unrelated purposes, including marketing.',
            'Interfering with the service or trying to access accounts or data that are not yours.',
          ],
        },
        {
          heading: 'Suspension and blocking',
          paragraphs: [
            'SevaSetu administrators may reject or suspend an organization, cancel an event, or block an account that breaks these terms or puts others at risk. Where possible we explain why. You can contact us to ask for a review.',
          ],
        },
        {
          heading: 'Content',
          paragraphs: [
            'You keep ownership of what you write (such as event descriptions and progress notes) and allow SevaSetu to store and show it to the people who need it to run the seva. We may remove content that breaks these terms.',
          ],
        },
        {
          heading: 'No guarantees',
          paragraphs: [
            'SevaSetu is provided as it is. We work to keep it available and accurate, but we cannot promise it will always be uninterrupted or error-free. We are not responsible for seva activities run by organizations, or for loss or injury arising from them, to the extent the law allows.',
          ],
        },
        {
          heading: 'Changes and contact',
          paragraphs: [
            'We may update these terms; the date at the top shows the latest version, and significant changes will be announced in the app. These terms are governed by the laws of Ontario and Canada.',
            `Questions: ${CONTACT_EMAIL}.`,
          ],
        },
      ]}
    />
  );
}
