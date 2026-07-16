import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black py-12" data-testid="footer">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="font-display text-2xl text-primary tracking-widest hover:opacity-80 transition-opacity inline-block mb-4">
              EBOOKGAME<span className="italic text-white" style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 0 8px rgba(201, 169, 113, 0.5)' }}>Z</span>
            </Link>
            <p className="text-muted-foreground text-sm font-serif max-w-xs">
              A digital sanctuary for lovers of timeless stories and cinematic masterpieces.
            </p>
            <img
              src="/ebookgamez-logo.png"
              alt="EbookGamez"
              className="mt-4 h-16 w-16 rounded-xl object-cover object-top opacity-75 hover:opacity-100 transition-opacity"
            />
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 font-serif text-sm uppercase tracking-wider">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground font-serif">
              <li><Link href="/catalog" className="hover:text-primary transition-colors" data-testid="link-footer-catalog">Ebook Store</Link></li>
              <li><Link href="/games" className="hover:text-primary transition-colors">Play Games</Link></li>
              <li><Link href="/downloads" className="hover:text-primary transition-colors">Download Hub</Link></li>
              <li><Link href="/guides" className="hover:text-primary transition-colors">Gaming Guides</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors" data-testid="link-footer-blog">Blog</Link></li>
              <li><Link href="/subscription" className="hover:text-primary transition-colors">Reading Pass</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors" data-testid="link-footer-about">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 font-serif text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground font-serif">
              <li><Link href="/privacy-policy" className="hover:text-primary transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-primary transition-colors" data-testid="link-footer-terms">Terms of Service</Link></li>
              <li><Link href="/refund-policy" className="hover:text-primary transition-colors" data-testid="link-footer-refund">Refund Policy</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors" data-testid="link-footer-contact">Contact</Link></li>
              <li><Link href="/cookie-policy" className="hover:text-primary transition-colors" data-testid="link-footer-cookie">Cookie Policy</Link></li>
              <li><Link href="/authors" className="hover:text-primary transition-colors" data-testid="link-footer-authors">Publish With Us</Link></li>
              <li><Link href="/affiliates" className="hover:text-primary transition-colors" data-testid="link-footer-affiliates">Affiliate Program</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 text-center">
          <p className="text-xs text-white/30 font-body">
            &copy; {new Date().getFullYear()} EbookGamez. All rights reserved.
          </p>
          <p className="text-xs text-white/20 font-body mt-1">
            P.O. Box 1181, Las Vegas, NV 89125 &bull; ebookgames@yahoo.com
          </p>
          <p className="text-xs text-white/20 font-body mt-1">
            All ebooks are digital products delivered electronically. Payments processed securely by Stripe.
          </p>
          <p className="text-xs text-white/20 font-body mt-1">
            AI Content Disclosure: Ebook text, cover artwork, and illustrations are created with AI assistance and reviewed before publication.
          </p>
        </div>
      </div>
    </footer>
  );
}
