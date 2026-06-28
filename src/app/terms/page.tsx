import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | Spotted",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="mx-auto max-w-2xl prose prose-sm">
        <h1 className="text-2xl font-bold mb-6">Terms of Use</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">About Spotted</h2>
          <p className="text-sm text-muted-foreground">
            Spotted (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a UK celebrity fashion discovery
            website. We help fans find shoppable alternatives to outfits worn by
            their favourite celebrities. By using spotted.co.uk you agree to
            these terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Use of the site</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>You must be 13 years of age or older to use Spotted.</li>
            <li>You may not use Spotted for any unlawful purpose.</li>
            <li>
              You may not scrape, copy, or reproduce content from Spotted
              without our written permission.
            </li>
            <li>
              We reserve the right to remove accounts or content at our
              discretion.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">User content</h2>
          <p className="text-sm text-muted-foreground">
            When you post comments on Spotted, you grant us a non-exclusive
            licence to display that content on the site. You are responsible for
            ensuring your comments do not contain illegal, offensive, or
            defamatory content. We may remove any content that breaches these
            terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Affiliate links</h2>
          <p className="text-sm text-muted-foreground">
            Some product links on Spotted are affiliate links. If you click a
            link and make a purchase, we may earn a small commission at no extra
            cost to you. This does not influence the products we feature.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Celebrity images</h2>
          <p className="text-sm text-muted-foreground">
            Images of celebrities on Spotted are used for editorial and
            informational purposes. If you believe any image infringes your
            copyright, please contact us at{" "}
            <a href="mailto:hello@spotted.co.uk" className="underline">
              hello@spotted.co.uk
            </a>{" "}
            and we will remove it promptly.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Disclaimer of warranties
          </h2>
          <p className="text-sm text-muted-foreground">
            Spotted is provided &quot;as is&quot; without warranties of any kind. We do not
            guarantee that product information, prices, or availability shown on
            the site are accurate or up to date. Always verify details on the
            retailer&apos;s own website before purchasing.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Limitation of liability</h2>
          <p className="text-sm text-muted-foreground">
            To the fullest extent permitted by UK law, Spotted shall not be
            liable for any indirect, incidental, or consequential losses arising
            from your use of the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Changes to these terms</h2>
          <p className="text-sm text-muted-foreground">
            We may update these terms from time to time. Continued use of
            Spotted after changes are posted constitutes your acceptance of the
            new terms.
          </p>
        </section>
      </div>
    </div>
  );
}
