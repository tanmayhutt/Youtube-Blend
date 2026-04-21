import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Logo size={32} className="rounded-lg" />
              <h1 className="text-2xl font-bold">Terms of Service</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using YouTube Blend, you accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              YouTube Blend is a web application that allows users to compare their YouTube viewing preferences and interests with friends.
              The service analyzes your YouTube subscriptions, liked videos, and playlists to generate compatibility scores.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>
              To use YouTube Blend, you must:
            </p>
            <ul>
              <li>Have a valid Google account</li>
              <li>Authorize our application to access your YouTube data (read-only)</li>
              <li>Be at least 13 years old (or the minimum age in your jurisdiction)</li>
            </ul>
          </section>

          <section>
            <h2>4. Permissions and Data Access</h2>
            <p>
              By using YouTube Blend, you grant us permission to:
            </p>
            <ul>
              <li>Access your YouTube subscriptions, liked videos, and playlists (read-only)</li>
              <li>Store this data securely for comparison purposes</li>
              <li>Display your data in comparison results with other users who have consented</li>
            </ul>
            <p>
              You can revoke this access at any time through your Google Account Settings.
            </p>
          </section>

          <section>
            <h2>5. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul>
              <li>Use the service only for lawful purposes</li>
              <li>Not attempt to harm, disrupt, or interfere with the service</li>
              <li>Not share comparison links with unauthorized users</li>
              <li>Respect the privacy of other users</li>
            </ul>
          </section>

          <section>
            <h2>6. Service Availability</h2>
            <p>
              We strive to provide reliable service but do not guarantee uninterrupted or error-free operation.
              The service may be temporarily unavailable due to maintenance, updates, or unforeseen circumstances.
            </p>
          </section>

          <section>
            <h2>7. Limitation of Liability</h2>
            <p>
              YouTube Blend is provided "as is" without warranties of any kind. We are not liable for any damages arising from:
            </p>
            <ul>
              <li>Use or inability to use the service</li>
              <li>Unauthorized access to your data</li>
              <li>Errors or omissions in the service</li>
            </ul>
          </section>

          <section>
            <h2>8. Data Deletion</h2>
            <p>
              You may request deletion of your account and associated data at any time.
              Upon deletion, all your stored data will be permanently removed from our systems.
            </p>
          </section>

          <section>
            <h2>9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2>10. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us through our website or GitHub repository.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;

