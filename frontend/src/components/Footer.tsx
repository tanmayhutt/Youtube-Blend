export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur mt-12">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">About YouTube Blend</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Discover how your YouTube taste compares with friends. Share, compare, and explore each other's viewing habits in a fun way.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/dashboard" className="hover:text-foreground transition">Dashboard</a></li>
              <li><a href="/privacy" className="hover:text-foreground transition">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-foreground transition">Terms of Service</a></li>
            </ul>
          </div>

          {/* Social & Info */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Connect</h3>
            <p className="text-sm text-muted-foreground">
              Made with 💜 for YouTube fans everywhere.
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © {currentYear} YouTube Blend. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground mt-4 md:mt-0">
            YouTube is a trademark of Google LLC. YouTube Blend is not affiliated with Google.
          </p>
        </div>
      </div>
    </footer>
  );
};
