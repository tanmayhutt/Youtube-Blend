import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

const Privacy = () => {
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
              <h1 className="text-2xl font-bold">Privacy Policy</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>
              YouTube Blend collects the following information from your Google account when you authorize our application:
            </p>
            <ul>
              <li><strong>YouTube Subscriptions:</strong> List of channels you are subscribed to</li>
              <li><strong>Liked Videos:</strong> Videos you have liked on YouTube</li>
              <li><strong>Playlists:</strong> Your YouTube playlists and their contents</li>
              <li><strong>Basic Profile Information:</strong> Your Google account email and profile information</li>
            </ul>
            <p>
              We only request read-only access to your YouTube data. We do not modify, delete, or share your YouTube content.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use the collected information solely for the following purposes:</p>
            <ul>
              <li>To generate compatibility comparisons between you and your friends</li>
              <li>To display your YouTube interests and preferences</li>
              <li>To calculate similarity scores for comparison features</li>
            </ul>
            <p>We do not sell, rent, or share your personal information with third parties.</p>
          </section>

          <section>
            <h2>3. Data Storage</h2>
            <p>
              Your YouTube data is stored securely in our database (MongoDB Atlas) and is associated with your Google account ID.
              We retain this data to provide the comparison service. You can request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2>4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul>
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure database storage</li>
              <li>OAuth 2.0 authentication</li>
            </ul>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your stored data</li>
              <li>Request deletion of your account and data</li>
              <li>Revoke access to your Google account at any time through Google Account Settings</li>
            </ul>
          </section>

          <section>
            <h2>6. Third-Party Services</h2>
            <p>
              We use Google OAuth 2.0 for authentication. Your interaction with Google is governed by Google's Privacy Policy.
              We do not have access to your Google password or other sensitive account information.
            </p>
          </section>

          <section>
            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page
              and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2>8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us through our website or GitHub repository.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;

