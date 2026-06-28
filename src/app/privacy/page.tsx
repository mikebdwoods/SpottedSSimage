import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Spotted",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="mx-auto max-w-2xl prose prose-sm">
        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Who we are</h2>
          <p className="text-sm text-muted-foreground">
            Spotted is a UK celebrity fashion discovery website. We help fans find
            shoppable alternatives to the outfits their favourite celebrities wear.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">What data we collect</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>Email address and display name if you create an account</li>
            <li>Comments you post on looks</li>
            <li>Newsletter email address if you subscribe</li>
            <li>Usage data via cookies (see below)</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Cookies</h2>
          <p className="text-sm text-muted-foreground mb-2">
            We use the following types of cookies:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>
              <strong>Essential cookies</strong> — required to keep you signed in.
              These cannot be disabled.
            </li>
            <li>
              <strong>Analytics cookies</strong> — used to understand how visitors
              use the site. You can decline these via our cookie banner.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Affiliate links</h2>
          <p className="text-sm text-muted-foreground">
            Some product links on Spotted are affiliate links. If you click a link
            and make a purchase, we may earn a small commission at no extra cost to
            you. We only link to products we genuinely believe are good matches.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Your rights</h2>
          <p className="text-sm text-muted-foreground">
            Under UK GDPR you have the right to access, correct, or delete your
            personal data. To make a request, email us at{" "}
            <a href="mailto:hello@spotted.co.uk" className="underline">
              hello@spotted.co.uk
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Data storage</h2>
          <p className="text-sm text-muted-foreground">
            Your data is stored securely using Supabase, hosted in the EU.
          </p>
        </section>
      </div>
    </div>
  );
}
