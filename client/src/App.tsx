import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsent } from "@/components/cookie-consent";
import { PageTracker } from "@/components/page-tracker";
import { ChatWidget } from "@/components/chat-widget";
import { SocialProofWidget } from "@/components/social-proof-widget";
import { Loader2 } from "lucide-react";

const Home = lazy(() => import("@/pages/home"));
const Catalog = lazy(() => import("@/pages/catalog"));
const About = lazy(() => import("@/pages/about"));
const AdminDashboard = lazy(() => import("@/pages/admin"));
const BookDetail = lazy(() => import("@/pages/book-detail"));
const Cart = lazy(() => import("@/pages/cart"));
const CheckoutSuccess = lazy(() => import("@/pages/checkout-success"));
const ContentStudio = lazy(() => import("@/pages/content-studio"));
const BatchCoverReview = lazy(() => import("@/pages/batch-cover-review"));
const BookReader = lazy(() => import("@/pages/book-reader"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const RefundPolicy = lazy(() => import("@/pages/refund-policy"));
const Contact = lazy(() => import("@/pages/contact"));
const Games = lazy(() => import("@/pages/games"));
const Downloads = lazy(() => import("@/pages/downloads"));
const Guides = lazy(() => import("@/pages/guides"));
const GuideDetail = lazy(() => import("@/pages/guide-detail"));
const DuplicateComparison = lazy(() => import("@/pages/duplicate-comparison"));
const RewriteBlockers = lazy(() => import("@/pages/rewrite-blockers"));
const Subscription = lazy(() => import("@/pages/subscription"));
const SubscriptionSuccess = lazy(() => import("@/pages/subscription-success"));
const OrphanCoverReview = lazy(() => import("@/pages/orphan-cover-review"));
const SiteAnalytics = lazy(() => import("@/pages/site-analytics"));
const Authors = lazy(() => import("@/pages/authors"));
const Affiliates = lazy(() => import("@/pages/affiliates"));
const AuthorLibrary = lazy(() => import("@/pages/author-library"));
const EpubExportHub = lazy(() => import("@/pages/epub-export-hub"));
const QualityScan = lazy(() => import("@/pages/quality-scan"));
const CookiePolicy = lazy(() => import("@/pages/cookie-policy"));
const CustomerLogin = lazy(() => import("@/pages/customer-login"));
const CustomerSignup = lazy(() => import("@/pages/customer-signup"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const MyAccount = lazy(() => import("@/pages/my-account"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AdPreview = lazy(() => import("@/pages/ad-preview"));

// Migration: purge any raw admin password that may have been stored in older
// versions of the app. The current auth model stores only revocable session
// tokens under "ebgz_admin_token" — raw passwords must never persist.
if (typeof window !== "undefined") {
  localStorage.removeItem("ebgz_admin_pw");
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/catalog" component={Catalog} />
        <Route path="/book/:id" component={BookDetail} />
        <Route path="/books/:id" component={BookDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/about" component={About} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/duplicates" component={DuplicateComparison} />
        <Route path="/admin/rewrite-blockers" component={RewriteBlockers} />
        <Route path="/content-studio" component={ContentStudio} />
        <Route path="/batch-cover-review" component={BatchCoverReview} />
        <Route path="/read/book/:bookId" component={BookReader} />
        <Route path="/read/:id" component={BookReader} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/contact" component={Contact} />
        <Route path="/games" component={Games} />
        <Route path="/downloads" component={Downloads} />
        <Route path="/guides" component={Guides} />
        <Route path="/guides/:id" component={GuideDetail} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/subscription/success" component={SubscriptionSuccess} />
        <Route path="/admin/orphan-covers" component={OrphanCoverReview} />
        <Route path="/admin/analytics" component={SiteAnalytics} />
        <Route path="/authors" component={Authors} />
        <Route path="/affiliates" component={Affiliates} />
        <Route path="/admin/author-library" component={AuthorLibrary} />
        <Route path="/admin/epub-export" component={EpubExportHub} />
        <Route path="/admin/quality-scan" component={QualityScan} />
        <Route path="/cookie-policy" component={CookiePolicy} />
        <Route path="/login" component={CustomerLogin} />
        <Route path="/signup" component={CustomerSignup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/my-account" component={MyAccount} />
        <Route path="/ad-preview" component={AdPreview} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PageTracker />
        <Router />
        <Toaster />
        <CookieConsent />
        <ChatWidget />
        <SocialProofWidget />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
