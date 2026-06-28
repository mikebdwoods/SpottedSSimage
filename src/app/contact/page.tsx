import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | Spotted",
  description: "Get in touch with the Spotted team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl font-black tracking-tight mb-2">Contact us</h1>
        <p className="text-muted-foreground mb-10">
          Got a question, a DMCA request, or want to work with us? Drop us a
          line.
        </p>

        <div className="space-y-6">
          <div className="border rounded-xl p-5">
            <h2 className="font-semibold mb-1">General enquiries</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Questions about Spotted, the site, or how it works.
            </p>
            <a
              href="mailto:hello@spotted.co.uk"
              className="text-sm font-medium underline hover:no-underline"
            >
              hello@spotted.co.uk
            </a>
          </div>

          <div className="border rounded-xl p-5">
            <h2 className="font-semibold mb-1">Image removal / DMCA</h2>
            <p className="text-sm text-muted-foreground mb-2">
              If you believe an image on Spotted infringes your copyright, email
              us and we will remove it within 48 hours.
            </p>
            <a
              href="mailto:dmca@spotted.co.uk"
              className="text-sm font-medium underline hover:no-underline"
            >
              dmca@spotted.co.uk
            </a>
          </div>

          <div className="border rounded-xl p-5">
            <h2 className="font-semibold mb-1">Data & privacy</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Requests to access, correct, or delete your personal data under UK
              GDPR.
            </p>
            <a
              href="mailto:privacy@spotted.co.uk"
              className="text-sm font-medium underline hover:no-underline"
            >
              privacy@spotted.co.uk
            </a>
          </div>

          <div className="border rounded-xl p-5">
            <h2 className="font-semibold mb-1">Partnerships & advertising</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Interested in featuring your brand or product on Spotted?
            </p>
            <a
              href="mailto:partnerships@spotted.co.uk"
              className="text-sm font-medium underline hover:no-underline"
            >
              partnerships@spotted.co.uk
            </a>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          We aim to respond to all emails within 2 working days.
        </p>
      </div>
    </div>
  );
}
